// Shared between client and server. Must match the CHECK constraints in the SQL migration.
export const EXAMS = ["IELTS", "UNT", "NIS", "BIL", "NUET", "SAT"] as const;
export type Exam = (typeof EXAMS)[number];

export const OUTPUT_LANGUAGES = ["kk", "ru"] as const;
export type OutputLanguage = (typeof OUTPUT_LANGUAGES)[number];

export function isExam(value: string): value is Exam {
  return (EXAMS as readonly string[]).includes(value);
}

export function isOutputLanguage(value: string): value is OutputLanguage {
  return (OUTPUT_LANGUAGES as readonly string[]).includes(value);
}

// Text length limits, mirrored by CHECK constraints in the SQL migrations.
export const LIMITS = {
  name: 100,
  short: 30, // grade_or_age, target_score, phone
  topic: 200,
  long: 2000, // notes, tutor_note
} as const;

export const STUDENT_TABS = ["lessons", "homework", "grades", "reports"] as const;
export type StudentTab = (typeof STUDENT_TABS)[number];

export type Student = {
  id: string;
  tutor_id: string;
  full_name: string;
  grade_or_age: string | null;
  exam_track: Exam;
  target_score: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_language: OutputLanguage;
  notes: string | null;
  /** Fictional student created by "Load demo data". */
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

export type Lesson = {
  id: string;
  tutor_id: string;
  student_id: string;
  starts_at: string;
  duration_min: number;
  topic: string | null;
  attended: boolean | null;
  tutor_note: string | null;
  created_at: string;
  updated_at: string;
};

export type LessonWithStudent = Lesson & {
  student: Pick<Student, "id" | "full_name" | "exam_track"> | null;
};

export type Rubric = {
  id: string;
  /** null = platform rubric (readable by all tutors, editable by the admin only). */
  owner: string | null;
  exam: Exam;
  task_type: string;
  name: string;
  version: string;
  scale_min: number;
  scale_max: number;
  scale_step: number;
  overall_rule: string;
  criteria: import("@/lib/rubrics").RubricCriterion[];
  source_url: string | null;
  /** Plain date "YYYY-MM-DD", or null when never verified. */
  last_verified: string | null;
  created_at: string;
  updated_at: string;
};

// --- Submissions -----------------------------------------------------------------------------

/** Accepted upload types: extension → MIME type. Mirrors the Storage bucket's allowed types. */
export const SUBMISSION_FILE_TYPES = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;
export type SubmissionMime = (typeof SUBMISSION_FILE_TYPES)[keyof typeof SUBMISSION_FILE_TYPES];
export const DOCX_MIME = SUBMISSION_FILE_TYPES.docx;
export const MAX_SUBMISSION_FILE_BYTES = 15 * 1024 * 1024;
export const SUBMISSION_LIMITS = { taskPrompt: 5000, text: 50000 } as const;

export const SUBMISSION_STATUSES = ["draft", "ai_done", "approved"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export type Submission = {
  id: string;
  tutor_id: string;
  student_id: string;
  rubric_id: string | null;
  rubric_snapshot: import("@/lib/grading").RubricSnapshot | null;
  task_prompt: string;
  file_path: string | null;
  file_mime: SubmissionMime | null;
  text_content: string | null;
  ai_result: unknown;
  final_result: import("@/lib/grading").GradeResult | null;
  status: SubmissionStatus;
  graded_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SubmissionWithRefs = Submission & {
  student: Pick<Student, "id" | "full_name" | "exam_track"> | null;
  rubric: Pick<Rubric, "id" | "name"> | null;
};

// --- Homework --------------------------------------------------------------------------------

export const HOMEWORK_STATUSES = ["draft", "assigned"] as const;
export type HomeworkStatus = (typeof HOMEWORK_STATUSES)[number];

export type Homework = {
  id: string;
  tutor_id: string;
  student_id: string | null;
  title: string;
  exam: Exam;
  level: string | null;
  topic: string | null;
  item_types: import("@/lib/homework-types").HomeworkItemType[];
  item_count: number | null;
  student_sheet: import("@/lib/homework").StudentSheet;
  teacher_key: import("@/lib/homework").TeacherKey;
  source_files: string[];
  status: HomeworkStatus;
  due_date: string | null;
  assigned_at: string | null;
  created_at: string;
  updated_at: string;
};

export type HomeworkWithStudent = Homework & { student: Pick<Student, "id" | "full_name"> | null };

/** What may be shown to a student or parent: NO teacher_key. */
export type HomeworkSheetOnly = Pick<Homework, "id" | "title" | "exam" | "level" | "student_sheet" | "due_date"> & {
  student: Pick<Student, "full_name"> | null;
};

// --- Reports ---------------------------------------------------------------------------------

export const REPORT_STATUSES = ["draft", "approved", "sent"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export const REPORT_MESSAGE_MAX = 4000;

export type Report = {
  id: string;
  tutor_id: string;
  student_id: string;
  week_start: string;
  input_data: import("@/lib/report-input").ReportInput;
  ai_status: "ok" | "needs_data" | null;
  missing: string[];
  message: string | null;
  status: ReportStatus;
  share_token: string | null;
  approved_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReportWithStudent = Report & {
  student: Pick<Student, "id" | "full_name" | "parent_name" | "parent_phone" | "parent_language"> | null;
};

export type Tutor = {
  id: string;
  full_name: string;
  phone: string | null;
  exams: Exam[];
  output_language: OutputLanguage;
  created_at: string;
  updated_at: string;
};
