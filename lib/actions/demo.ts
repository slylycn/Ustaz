"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { getTutor } from "@/lib/auth";
import { listRubrics } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { DEMO_ESSAYS, DEMO_EVIDENCE, DEMO_TEXT } from "@/lib/demo-data";
import { overallFor, snapshotRubric, type GradeResult, type RubricSnapshot } from "@/lib/grading";
import { addDays, todayKey, zonedToUtc } from "@/lib/time";

export type DemoResult = { ok: true } | { ok: false; error: "alreadyLoaded" | "generic" };

function gradeFor(snapshot: RubricSnapshot, scores: number[], comments: string[], evidence: string[][], feedback: string, flags: string[]): GradeResult {
  const criteria = snapshot.criteria.map((c, i) => ({
    name: c.name,
    score: scores[i] ?? scores[scores.length - 1],
    evidence: evidence[i] ?? [],
    comment: comments[i] ?? "",
  }));
  // Overall computed in code, like every real grade.
  return { criteria, ...overallFor(snapshot, criteria.map((c) => c.score), null), student_feedback: feedback, flags };
}

/**
 * Creates 3 fictional students (IELTS, UNT, NIS) with lessons around today, two IELTS essays
 * (one to grade live, one already graded and waiting for review) and two approved past grades
 * so the Grades tab, reports and the parent chart have something to show.
 */
export async function loadDemoData(): Promise<DemoResult> {
  const tutor = await getTutor();
  if (!tutor) return { ok: false, error: "generic" };
  const locale = await getLocale();
  const text = DEMO_TEXT[locale];
  const supabase = await createClient();

  const { count } = await supabase.from("students").select("id", { count: "exact", head: true }).eq("is_demo", true);
  if (count) return { ok: false, error: "alreadyLoaded" };

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .insert(
      text.students.map((s) => ({
        tutor_id: tutor.id,
        is_demo: true,
        full_name: s.full_name,
        exam_track: s.exam,
        grade_or_age: s.grade_or_age,
        target_score: s.target_score,
        parent_name: s.parent_name,
        parent_phone: s.parent_phone,
        parent_language: s.parent_language,
        notes: s.notes,
      })),
    )
    .select("id, exam_track");
  if (studentsError || !students) {
    console.error("loadDemoData students failed", studentsError?.message);
    return { ok: false, error: "generic" };
  }
  const idFor = (exam: string) => students.find((s) => s.exam_track === exam)!.id;

  // Lessons: two last week, one yesterday (with a note), one today, one tomorrow.
  const today = todayKey();
  const plan = [
    { day: -8, time: "16:00", attended: true },
    { day: -5, time: "16:00", attended: false },
    { day: -1, time: "17:00", attended: true, withNote: true },
    { day: 0, time: "18:00", attended: null },
    { day: 1, time: "16:30", attended: null },
  ];
  const lessons = text.students.flatMap((s, si) =>
    plan.map((p, i) => ({
      tutor_id: tutor.id,
      student_id: idFor(s.exam),
      // Stagger students by an hour so their lessons don't overlap.
      starts_at: zonedToUtc(addDays(today, p.day), `${String(Number(p.time.slice(0, 2)) + si).padStart(2, "0")}${p.time.slice(2)}`).toISOString(),
      duration_min: 60,
      topic: s.topics[i],
      attended: p.attended,
      tutor_note: p.withNote ? s.note : null,
    })),
  );
  const { error: lessonsError } = await supabase.from("lessons").insert(lessons);
  if (lessonsError) console.error("loadDemoData lessons failed", lessonsError.message);

  // Essays for the IELTS student, graded against the platform IELTS rubric (or the tutor's own).
  const rubrics = await listRubrics();
  const rubric =
    rubrics.find((r) => r.owner === null && r.name === "IELTS Writing Task 2") ?? rubrics.find((r) => r.exam === "IELTS");
  if (rubric) {
    const snapshot = snapshotRubric(rubric);
    const ieltsId = idFor("IELTS");
    const now = Date.now();
    const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();
    const past = (scores: number[]) => gradeFor(snapshot, scores, [], [], text.pastFeedback, []);

    const { error } = await supabase.from("submissions").insert([
      // Ready to grade live with Aqylbek.
      { tutor_id: tutor.id, student_id: ieltsId, rubric_id: rubric.id, task_prompt: DEMO_ESSAYS.draft.prompt, text_content: DEMO_ESSAYS.draft.text, status: "draft" },
      // Already "graded": shows the review screen even before Aqylbek is configured.
      {
        tutor_id: tutor.id, student_id: ieltsId, rubric_id: rubric.id, rubric_snapshot: snapshot,
        task_prompt: DEMO_ESSAYS.reviewed.prompt, text_content: DEMO_ESSAYS.reviewed.text, status: "ai_done", graded_at: daysAgo(0),
        final_result: gradeFor(snapshot, [7, 7, 6, 6], text.review.comments, DEMO_EVIDENCE, text.review.feedback, text.review.flags),
      },
      // Approved history for the Grades tab and the parent chart.
      {
        tutor_id: tutor.id, student_id: ieltsId, rubric_id: rubric.id, rubric_snapshot: snapshot,
        task_prompt: DEMO_ESSAYS.draft.prompt, text_content: DEMO_ESSAYS.draft.text, status: "approved",
        final_result: past([5, 6, 5, 5]), graded_at: daysAgo(21), approved_at: daysAgo(21),
      },
      {
        tutor_id: tutor.id, student_id: ieltsId, rubric_id: rubric.id, rubric_snapshot: snapshot,
        task_prompt: DEMO_ESSAYS.reviewed.prompt, text_content: DEMO_ESSAYS.reviewed.text, status: "approved",
        final_result: past([6, 6, 6, 5]), graded_at: daysAgo(7), approved_at: daysAgo(7),
      },
    ]);
    if (error) console.error("loadDemoData submissions failed", error.message);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Deletes demo students; their lessons, submissions and reports are removed by cascade. */
export async function removeDemoData(): Promise<DemoResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("students").delete().eq("is_demo", true);
  if (error) {
    console.error("removeDemoData failed", error.message);
    return { ok: false, error: "generic" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
