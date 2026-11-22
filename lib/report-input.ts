/**
 * The week's facts about one student, collected in code (lib/report-data.ts) and sent to
 * Aqylbek as the parent_report task. Stored on the report as input_data so the tutor can
 * see exactly what the message was based on.
 *
 * Privacy: only the student's FIRST name is included, and the tutor's private student
 * notes are never sent. Lesson notes are included because they're written for reporting.
 */
export type ReportInput = {
  week: { start: string; end: string }; // Almaty dates, Monday..Sunday
  student: { first_name: string; exam_track: string; grade_or_age: string | null; target_score: string | null };
  parent: { name: string | null; language: "kk" | "ru" };
  lessons: {
    total: number;
    attended: number;
    missed: number;
    not_marked: number;
    items: { date: string; time: string; duration_min: number; topic: string | null; attended: boolean | null; tutor_note: string | null }[];
  };
  homework: {
    assigned: { title: string; assigned_on: string | null; due_date: string | null; item_count: number }[];
  };
  work_submitted: { date: string; rubric: string | null; graded: boolean }[];
  grades: {
    /** Approved this week. */
    this_week: GradeFact[];
    /** Up to 3 approved before this week, for a trend. */
    previous: GradeFact[];
  };
};

export type GradeFact = {
  date: string;
  rubric: string | null;
  exam: string | null;
  overall: number | null;
  scale: { min: number; max: number } | null;
  criteria: { name: string; score: number | null }[];
};

/** Nothing at all happened this week: no point asking Aqylbek. */
export function isEmptyWeek(input: ReportInput): boolean {
  return (
    input.lessons.total === 0 &&
    input.homework.assigned.length === 0 &&
    input.work_submitted.length === 0 &&
    input.grades.this_week.length === 0
  );
}
