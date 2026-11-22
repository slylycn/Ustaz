/**
 * Grading data shapes and checks, shared by the server (actions) and the browser (review form).
 * The overall score is ALWAYS computed here from criterion scores when the rubric's rule is
 * understood (lib/overall-rule.ts); the model's overall number is never used.
 */
import type { Rubric } from "@/lib/constants";
import type { AqylbekOutput } from "@/lib/aqylbek-schemas";
import { computeOverall, parseOverallRule } from "@/lib/overall-rule";
import { isOnScale, roundScore } from "@/lib/rubrics";

/** The rubric as it was when the work was graded (stored on the submission). */
export type RubricSnapshot = Pick<
  Rubric,
  | "id"
  | "name"
  | "exam"
  | "task_type"
  | "version"
  | "scale_min"
  | "scale_max"
  | "scale_step"
  | "overall_rule"
  | "criteria"
>;

export type GradeCriterion = {
  name: string;
  score: number | null;
  evidence: string[];
  comment: string;
};

export type GradeResult = {
  criteria: GradeCriterion[];
  overall: number | null;
  /** "computed" = from the rubric rule in code; "tutor" = rule not computable, tutor picked it. */
  overall_source: "computed" | "tutor";
  student_feedback: string;
  flags: string[];
};

export const GRADE_LIMITS = {
  evidenceItems: 20,
  evidenceChars: 1000,
  comment: 3000,
  feedback: 10000,
  flags: 20,
  flagChars: 300,
} as const;

export function snapshotRubric(rubric: Rubric): RubricSnapshot {
  const { id, name, exam, task_type, version, scale_min, scale_max, scale_step, overall_rule, criteria } = rubric;
  return { id, name, exam, task_type, version, scale_min, scale_max, scale_step, overall_rule, criteria };
}

export function scaleOf(snapshot: RubricSnapshot) {
  return { min: Number(snapshot.scale_min), max: Number(snapshot.scale_max), step: Number(snapshot.scale_step) };
}

/** Overall from the rubric rule (in code) or, if the rule isn't computable, the tutor's on-scale pick. */
export function overallFor(
  snapshot: RubricSnapshot,
  scores: (number | null)[],
  tutorOverall: number | null,
): Pick<GradeResult, "overall" | "overall_source"> {
  const scale = scaleOf(snapshot);
  const rule = parseOverallRule(snapshot.overall_rule);
  if (rule) return { overall: computeOverall(rule, scores, scale), overall_source: "computed" };
  const valid = tutorOverall !== null && isOnScale(tutorOverall, scale.min, scale.max, scale.step);
  return { overall: valid ? roundScore(tutorOverall) : null, overall_source: "tutor" };
}

const clip = (value: string, max: number) => value.trim().slice(0, max);
const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * First draft for the tutor from Aqylbek's validated output. Criteria follow the rubric's
 * order and names; off-scale scores become empty for the tutor to fill in.
 */
export function draftFromAi(ai: AqylbekOutput<"grade">, snapshot: RubricSnapshot): GradeResult {
  const scale = scaleOf(snapshot);
  const byName = new Map(ai.criteria.map((c) => [normalizeName(c.name), c]));
  const sameLength = ai.criteria.length === snapshot.criteria.length;

  const criteria = snapshot.criteria.map((rubricCriterion, index) => {
    const match = byName.get(normalizeName(rubricCriterion.name)) ?? (sameLength ? ai.criteria[index] : undefined);
    const score =
      match && isOnScale(match.score, scale.min, scale.max, scale.step) ? roundScore(match.score) : null;
    return {
      name: rubricCriterion.name,
      score,
      evidence: (match?.evidence_quotes ?? [])
        .map((q) => clip(q, GRADE_LIMITS.evidenceChars))
        .filter(Boolean)
        .slice(0, GRADE_LIMITS.evidenceItems),
      comment: clip(match?.comment ?? "", GRADE_LIMITS.comment),
    };
  });

  return {
    criteria,
    ...overallFor(snapshot, criteria.map((c) => c.score), null), // never the model's overall
    student_feedback: clip(ai.student_feedback, GRADE_LIMITS.feedback),
    flags: ai.flags.map((f) => clip(f, GRADE_LIMITS.flagChars)).filter(Boolean).slice(0, GRADE_LIMITS.flags),
  };
}

export type ReviewError = "invalid" | "tooLong" | "offScale";

/**
 * Validates the tutor's edited result (JSON from the review form). Criterion names come from
 * the rubric snapshot, not the browser, and the overall is recomputed here.
 */
export function parseReview(
  raw: string,
  snapshot: RubricSnapshot,
): { ok: true; result: GradeResult } | { ok: false; error: ReviewError } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "invalid" };
  }
  if (!data || typeof data !== "object") return { ok: false, error: "invalid" };
  const input = data as Record<string, unknown>;
  const scale = scaleOf(snapshot);

  if (!Array.isArray(input.criteria) || input.criteria.length !== snapshot.criteria.length) {
    return { ok: false, error: "invalid" };
  }

  const criteria: GradeCriterion[] = [];
  for (let i = 0; i < snapshot.criteria.length; i++) {
    const c = input.criteria[i] as Record<string, unknown> | null;
    if (!c || typeof c !== "object") return { ok: false, error: "invalid" };

    const score = c.score === null ? null : Number(c.score);
    if (score !== null && !isOnScale(score, scale.min, scale.max, scale.step)) return { ok: false, error: "offScale" };

    if (!Array.isArray(c.evidence) || !c.evidence.every((q) => typeof q === "string")) return { ok: false, error: "invalid" };
    const evidence = (c.evidence as string[]).map((q) => q.trim()).filter(Boolean);
    if (evidence.length > GRADE_LIMITS.evidenceItems || evidence.some((q) => q.length > GRADE_LIMITS.evidenceChars)) {
      return { ok: false, error: "tooLong" };
    }

    if (typeof c.comment !== "string") return { ok: false, error: "invalid" };
    const comment = c.comment.trim();
    if (comment.length > GRADE_LIMITS.comment) return { ok: false, error: "tooLong" };

    criteria.push({ name: snapshot.criteria[i].name, score: score === null ? null : roundScore(score), evidence, comment });
  }

  if (typeof input.student_feedback !== "string") return { ok: false, error: "invalid" };
  const studentFeedback = input.student_feedback.trim();
  if (studentFeedback.length > GRADE_LIMITS.feedback) return { ok: false, error: "tooLong" };

  if (!Array.isArray(input.flags) || !input.flags.every((f) => typeof f === "string")) return { ok: false, error: "invalid" };
  const flags = (input.flags as string[]).map((f) => f.trim()).filter(Boolean);
  if (flags.length > GRADE_LIMITS.flags || flags.some((f) => f.length > GRADE_LIMITS.flagChars)) {
    return { ok: false, error: "tooLong" };
  }

  const tutorOverall = input.overall === null || input.overall === undefined ? null : Number(input.overall);
  return {
    ok: true,
    result: {
      criteria,
      ...overallFor(snapshot, criteria.map((c) => c.score), Number.isFinite(tutorOverall) ? tutorOverall : null),
      student_feedback: studentFeedback,
      flags,
    },
  };
}

/** Ready to approve: every criterion scored and an overall score present. */
export function isComplete(result: GradeResult): boolean {
  return result.overall !== null && result.criteria.every((c) => c.score !== null);
}
