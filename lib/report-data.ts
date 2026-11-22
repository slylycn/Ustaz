import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { GradeResult, RubricSnapshot } from "@/lib/grading";
import type { Student } from "@/lib/constants";
import type { GradeFact, ReportInput } from "@/lib/report-input";
import { addDays, zonedDateKey, zonedTime, zonedToUtc } from "@/lib/time";

type GradeRow = { approved_at: string; final_result: GradeResult | null; rubric_snapshot: RubricSnapshot | null };

function toGradeFact(row: GradeRow): GradeFact {
  const snap = row.rubric_snapshot;
  return {
    date: zonedDateKey(new Date(row.approved_at)),
    rubric: snap?.name ?? null,
    exam: snap?.exam ?? null,
    overall: row.final_result?.overall ?? null,
    scale: snap ? { min: Number(snap.scale_min), max: Number(snap.scale_max) } : null,
    criteria: (row.final_result?.criteria ?? []).map((c) => ({ name: c.name, score: c.score })),
  };
}

/**
 * Collects one student's week (Monday weekStart → Sunday, Asia/Almaty) from the tutor's own
 * rows (RLS applies). Only approved grades are used: drafts and raw AI results never are.
 */
export async function collectWeekData(student: Student, weekStart: string): Promise<ReportInput> {
  const supabase = await createClient();
  const fromIso = zonedToUtc(weekStart).toISOString();
  const toIso = zonedToUtc(addDays(weekStart, 7)).toISOString();
  const weekEnd = addDays(weekStart, 6);

  const [lessonsRes, homeworkRes, workRes, gradesRes, previousRes] = await Promise.all([
    supabase
      .from("lessons")
      .select("starts_at, duration_min, topic, attended, tutor_note")
      .eq("student_id", student.id)
      .gte("starts_at", fromIso)
      .lt("starts_at", toIso)
      .order("starts_at"),
    supabase
      .from("homework")
      .select("title, status, assigned_at, due_date, student_sheet")
      .eq("student_id", student.id)
      .eq("status", "assigned")
      // Assigned this week, or due this week (values quoted for PostgREST's filter syntax).
      .or(
        `and(assigned_at.gte."${fromIso}",assigned_at.lt."${toIso}"),and(due_date.gte."${weekStart}",due_date.lte."${weekEnd}")`,
      ),
    supabase
      .from("submissions")
      .select("created_at, status, rubric_snapshot, rubric:rubrics(name)")
      .eq("student_id", student.id)
      .gte("created_at", fromIso)
      .lt("created_at", toIso)
      .order("created_at"),
    supabase
      .from("submissions")
      .select("approved_at, final_result, rubric_snapshot")
      .eq("student_id", student.id)
      .eq("status", "approved")
      .gte("approved_at", fromIso)
      .lt("approved_at", toIso)
      .order("approved_at"),
    supabase
      .from("submissions")
      .select("approved_at, final_result, rubric_snapshot")
      .eq("student_id", student.id)
      .eq("status", "approved")
      .lt("approved_at", fromIso)
      .order("approved_at", { ascending: false })
      .limit(3),
  ]);
  for (const res of [lessonsRes, homeworkRes, workRes, gradesRes, previousRes]) {
    if (res.error) throw res.error;
  }

  const lessons = (lessonsRes.data ?? []) as {
    starts_at: string;
    duration_min: number;
    topic: string | null;
    attended: boolean | null;
    tutor_note: string | null;
  }[];

  return {
    week: { start: weekStart, end: weekEnd },
    student: {
      first_name: student.full_name.trim().split(/\s+/)[0] ?? "",
      exam_track: student.exam_track,
      grade_or_age: student.grade_or_age,
      target_score: student.target_score,
    },
    parent: { name: student.parent_name, language: student.parent_language },
    lessons: {
      total: lessons.length,
      attended: lessons.filter((l) => l.attended === true).length,
      missed: lessons.filter((l) => l.attended === false).length,
      not_marked: lessons.filter((l) => l.attended === null).length,
      items: lessons.map((l) => ({
        date: zonedDateKey(new Date(l.starts_at)),
        time: zonedTime(new Date(l.starts_at)),
        duration_min: l.duration_min,
        topic: l.topic,
        attended: l.attended,
        tutor_note: l.tutor_note,
      })),
    },
    homework: {
      assigned: (
        (homeworkRes.data ?? []) as {
          title: string;
          assigned_at: string | null;
          due_date: string | null;
          student_sheet: { items?: unknown[] } | null;
        }[]
      ).map((h) => ({
        title: h.title,
        assigned_on: h.assigned_at ? zonedDateKey(new Date(h.assigned_at)) : null,
        due_date: h.due_date,
        item_count: h.student_sheet?.items?.length ?? 0,
      })),
    },
    work_submitted: (
      (workRes.data ?? []) as unknown as {
        created_at: string;
        status: string;
        rubric_snapshot: RubricSnapshot | null;
        rubric: { name: string } | null;
      }[]
    ).map((w) => ({
      date: zonedDateKey(new Date(w.created_at)),
      rubric: w.rubric?.name ?? w.rubric_snapshot?.name ?? null,
      graded: w.status === "approved",
    })),
    grades: {
      this_week: ((gradesRes.data ?? []) as GradeRow[]).map(toGradeFact),
      previous: ((previousRes.data ?? []) as GradeRow[]).map(toGradeFact).reverse(),
    },
  };
}
