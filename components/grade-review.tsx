"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { saveReview, type ReviewState } from "@/lib/actions/submissions";
import { GRADE_LIMITS, overallFor, scaleOf, type GradeResult, type RubricSnapshot } from "@/lib/grading";
import { scaleKeyList, sortScoresDesc } from "@/lib/rubrics";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/form-field";

type Props = {
  submissionId: string;
  snapshot: RubricSnapshot;
  initial: GradeResult;
  /** Already-rendered description of how the overall is computed (server component). */
  ruleText: React.ReactNode;
};

type EditableCriterion = { score: string; evidence: string; comment: string };

const initialState: ReviewState = {};
const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

/**
 * Editable review of Aqylbek's grade. Everything can be changed; the overall score is
 * recalculated in code (here for display, and again on the server when saving).
 */
export function GradeReview({ submissionId, snapshot, initial, ruleText }: Props) {
  const t = useTranslations("submission.review");
  const [state, formAction, pending] = useActionState(saveReview, initialState);

  const scale = scaleOf(snapshot);
  const points = useMemo(() => sortScoresDesc(scaleKeyList(scale.min, scale.max, scale.step)), [scale.min, scale.max, scale.step]);

  const [criteria, setCriteria] = useState<EditableCriterion[]>(() =>
    initial.criteria.map((c) => ({
      score: c.score === null ? "" : String(c.score),
      evidence: c.evidence.join("\n"),
      comment: c.comment,
    })),
  );
  const [tutorOverall, setTutorOverall] = useState(initial.overall === null ? "" : String(initial.overall));
  const [feedback, setFeedback] = useState(initial.student_feedback);
  const [flags, setFlags] = useState(initial.flags.join("\n"));

  const scores = criteria.map((c) => (c.score === "" ? null : Number(c.score)));
  const overall = overallFor(snapshot, scores, tutorOverall === "" ? null : Number(tutorOverall));
  const complete = overall.overall !== null && scores.every((s) => s !== null);

  const payload = JSON.stringify({
    criteria: criteria.map((c, i) => ({ score: scores[i], evidence: lines(c.evidence), comment: c.comment })),
    overall: overall.overall,
    student_feedback: feedback,
    flags: lines(flags),
  });

  const update = (index: number, patch: Partial<EditableCriterion>) =>
    setCriteria((list) => list.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  return (
    <form action={formAction} className="grid gap-6">
      <input type="hidden" name="id" value={submissionId} />
      <input type="hidden" name="result" value={payload} />

      {/* Criteria table: one card per criterion on phones, a table row look on wide screens */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="hidden grid-cols-[12rem_6rem_1fr_1fr] gap-4 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground lg:grid">
          <span>{t("criterion")}</span>
          <span>{t("score")}</span>
          <span>{t("evidence")}</span>
          <span>{t("comment")}</span>
        </div>
        <ul className="divide-y">
          {snapshot.criteria.map((criterion, i) => {
            const id = `c${i}`;
            return (
              <li key={id} className="grid gap-3 p-4 lg:grid-cols-[12rem_6rem_1fr_1fr] lg:gap-4">
                <span className="font-medium">{criterion.name}</span>
                <div className="grid gap-1">
                  <Label htmlFor={`${id}-score`} className="lg:sr-only">
                    {t("score")}
                  </Label>
                  <NativeSelect
                    id={`${id}-score`}
                    value={criteria[i].score}
                    onChange={(e) => update(i, { score: e.target.value })}
                    aria-invalid={criteria[i].score === "" || undefined}
                  >
                    <option value="">{t("noScore")}</option>
                    {points.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`${id}-evidence`} className="lg:sr-only">
                    {t("evidence")}
                  </Label>
                  <Textarea
                    id={`${id}-evidence`}
                    rows={3}
                    placeholder={t("evidencePlaceholder")}
                    value={criteria[i].evidence}
                    onChange={(e) => update(i, { evidence: e.target.value })}
                    maxLength={GRADE_LIMITS.evidenceItems * (GRADE_LIMITS.evidenceChars + 1)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`${id}-comment`} className="lg:sr-only">
                    {t("comment")}
                  </Label>
                  <Textarea
                    id={`${id}-comment`}
                    rows={3}
                    value={criteria[i].comment}
                    onChange={(e) => update(i, { comment: e.target.value })}
                    maxLength={GRADE_LIMITS.comment}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Overall: computed in code from the rubric rule, or picked by the tutor if not computable */}
      <div className="grid gap-2 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium">{t("overall")}</span>
          {overall.overall_source === "computed" ? (
            <span className="text-2xl font-semibold tabular-nums">{overall.overall ?? t("overallPending")}</span>
          ) : (
            <NativeSelect
              aria-label={t("overall")}
              value={tutorOverall}
              onChange={(e) => setTutorOverall(e.target.value)}
              className="w-28"
            >
              <option value="">{t("noScore")}</option>
              {points.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </NativeSelect>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{ruleText}</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="feedback">{t("studentFeedback")}</Label>
        <Textarea
          id="feedback"
          rows={6}
          maxLength={GRADE_LIMITS.feedback}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="flags">{t("flags")}</Label>
        <Textarea
          id="flags"
          rows={3}
          placeholder={t("flagsPlaceholder")}
          value={flags}
          onChange={(e) => setFlags(e.target.value)}
          aria-describedby="flags-hint"
        />
        <p id="flags-hint" className="text-sm text-muted-foreground">
          {t("flagsHint")}
        </p>
      </div>

      <FieldError message={state.error && t(`errors.${state.error}`)} />
      {state.saved && !pending && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
          {t("saved")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" name="intent" value="approve" disabled={pending || !complete}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
          {t("approve")}
        </Button>
        <Button type="submit" name="intent" value="save" variant="outline" disabled={pending}>
          <Save aria-hidden />
          {t("saveDraft")}
        </Button>
        {!complete && <span className="text-sm text-muted-foreground">{t("incompleteHint")}</span>}
      </div>
    </form>
  );
}
