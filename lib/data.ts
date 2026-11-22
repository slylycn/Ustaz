import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation";
import type {
  HomeworkSheetOnly,
  HomeworkStatus,
  HomeworkWithStudent,
  Lesson,
  LessonWithStudent,
  ReportWithStudent,
  Rubric,
  Student,
  Submission,
  SubmissionStatus,
  SubmissionWithRefs,
} from "@/lib/constants";

// Read helpers. RLS already limits every query to the signed-in tutor's rows.

export async function listStudents(): Promise<Student[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Student[];
}

export async function getStudent(id: string): Promise<Student | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Student | null;
}

/** Lessons with fromIso <= starts_at < toIso, oldest first, with the student's name. */
export async function listLessonsBetween(fromIso: string, toIso: string): Promise<LessonWithStudent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lessons")
    .select("*, student:students(id, full_name, exam_track)")
    .gte("starts_at", fromIso)
    .lt("starts_at", toIso)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LessonWithStudent[];
}

export async function listStudentLessons(studentId: string): Promise<Lesson[]> {
  if (!isUuid(studentId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("student_id", studentId)
    .order("starts_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Lesson[];
}

export async function getLesson(id: string): Promise<Lesson | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("lessons").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Lesson | null;
}

// Numeric columns can arrive as strings depending on precision; normalize them.
export function toRubric(row: Record<string, unknown>): Rubric {
  return {
    ...(row as Rubric),
    scale_min: Number(row.scale_min),
    scale_max: Number(row.scale_max),
    scale_step: Number(row.scale_step),
  };
}

/** Platform rubrics (owner null) plus the tutor's own, via RLS. */
export async function listRubrics(): Promise<Rubric[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rubrics")
    .select("*")
    .order("exam", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toRubric);
}

export async function getRubric(id: string): Promise<Rubric | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("rubrics").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toRubric(data) : null;
}

// --- Submissions -------------------------------------------------------------------------------

const SUBMISSION_REFS = "*, student:students(id, full_name, exam_track), rubric:rubrics(id, name)";

export async function listSubmissions(status?: SubmissionStatus): Promise<SubmissionWithRefs[]> {
  const supabase = await createClient();
  let query = supabase
    .from("submissions")
    .select(SUBMISSION_REFS)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SubmissionWithRefs[];
}

export async function getSubmission(id: string): Promise<SubmissionWithRefs | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("submissions").select(SUBMISSION_REFS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as SubmissionWithRefs | null;
}

/**
 * The ONLY source of grades for the Grades tab and reports: approved submissions,
 * using the tutor-approved final_result (never the raw AI result).
 */
export async function listApprovedGrades(studentId: string): Promise<Submission[]> {
  if (!isUuid(studentId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("student_id", studentId)
    .eq("status", "approved")
    .not("final_result", "is", null)
    .order("approved_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Submission[];
}

// --- Homework ----------------------------------------------------------------------------------

export async function listHomework(status?: HomeworkStatus): Promise<HomeworkWithStudent[]> {
  const supabase = await createClient();
  let query = supabase
    .from("homework")
    .select("*, student:students(id, full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as HomeworkWithStudent[];
}

export async function listStudentHomework(studentId: string): Promise<HomeworkWithStudent[]> {
  if (!isUuid(studentId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("homework")
    .select("*, student:students(id, full_name)")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as HomeworkWithStudent[];
}

/** Full homework INCLUDING the teacher key. Tutor screens only. */
export async function getHomework(id: string): Promise<HomeworkWithStudent | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("homework")
    .select("*, student:students(id, full_name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as HomeworkWithStudent | null;
}

/**
 * Student-safe view: selects named columns only, so teacher_key is never fetched.
 * Use this for the print sheet and any future parent/student link.
 */
export async function getHomeworkSheet(id: string): Promise<HomeworkSheetOnly | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("homework")
    .select("id, title, exam, level, student_sheet, due_date, student:students(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as HomeworkSheetOnly | null;
}

// --- Reports -----------------------------------------------------------------------------------

const REPORT_REFS = "*, student:students(id, full_name, parent_name, parent_phone, parent_language)";

export async function listReportsForWeek(weekStart: string): Promise<ReportWithStudent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("reports").select(REPORT_REFS).eq("week_start", weekStart);
  if (error) throw error;
  return (data ?? []) as ReportWithStudent[];
}

export async function listStudentReports(studentId: string): Promise<ReportWithStudent[]> {
  if (!isUuid(studentId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select(REPORT_REFS)
    .eq("student_id", studentId)
    .order("week_start", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as ReportWithStudent[];
}

export async function getReport(id: string): Promise<ReportWithStudent | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("reports").select(REPORT_REFS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as ReportWithStudent | null;
}

// --- Dashboard ---------------------------------------------------------------------------------

export type AiUsage = {
  calls: number;
  ok: number;
  busy: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  byMode: Record<"grade" | "homework" | "parent_report", number>;
};

/** Aqylbek usage since fromIso, summed from ai_runs (metadata only, no student text). */
export async function getAiUsage(fromIso: string): Promise<AiUsage> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_runs")
    .select("mode, status, input_tokens, output_tokens")
    .gte("created_at", fromIso)
    .limit(10000);
  if (error) throw error;
  const usage: AiUsage = {
    calls: 0, ok: 0, busy: 0, failed: 0, inputTokens: 0, outputTokens: 0,
    byMode: { grade: 0, homework: 0, parent_report: 0 },
  };
  for (const run of (data ?? []) as { mode: keyof AiUsage["byMode"]; status: string; input_tokens: number; output_tokens: number }[]) {
    usage.calls += 1;
    if (run.status === "ok") usage.ok += 1;
    else if (run.status === "busy") usage.busy += 1;
    else usage.failed += 1;
    usage.inputTokens += run.input_tokens;
    usage.outputTokens += run.output_tokens;
    if (run.mode in usage.byMode) usage.byMode[run.mode] += 1;
  }
  return usage;
}

export async function hasDemoStudents(): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("students").select("id", { count: "exact", head: true }).eq("is_demo", true);
  if (error) throw error;
  return (count ?? 0) > 0;
}
