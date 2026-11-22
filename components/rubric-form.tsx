"use client";

import { useActionState, useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { saveRubric, type RubricField, type RubricFormState } from "@/lib/actions/rubrics";
import { EXAMS, type Exam } from "@/lib/constants";
import {
  RUBRIC_LIMITS,
  isOnScale,
  scaleKeyList,
  scorePointsForEditor,
  sortScoresDesc,
  type RubricCriterion,
} from "@/lib/rubrics";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Field, FieldError, describedBy } from "@/components/form-field";

export type RubricFormValues = {
  exam: Exam;
  taskType: string;
  name: string;
  version: string;
  scaleMin: string;
  scaleMax: string;
  scaleStep: string;
  overallRule: string;
  sourceUrl: string;
  lastVerified: string;
  criteria: RubricCriterion[];
};

type FieldValues = Omit<RubricFormValues, "criteria">;

type Props = {
  rubricId?: string;
  initial: RubricFormValues;
  /** Admin creating a new rubric: show the "platform rubric" checkbox. */
  canCreatePlatform: boolean;
  /** Editing an existing platform rubric (admin only). */
  editingPlatform: boolean;
  /** Today's Almaty date, for the "Today" button and the date input's max. */
  today: string;
  cancelHref: string;
  extraActions?: React.ReactNode;
};

type Row = { key: string; score: string; text: string };
type CriterionState = { key: string; name: string; rows: Row[] };

let keySeq = 0;
const nextKey = () => `k${++keySeq}`;

function toState(criteria: RubricCriterion[]): CriterionState[] {
  return criteria.map((c) => ({
    key: nextKey(),
    name: c.name,
    rows: sortScoresDesc(Object.keys(c.descriptors_by_score)).map((score) => ({
      key: nextKey(),
      score,
      text: c.descriptors_by_score[score] ?? "",
    })),
  }));
}

function toPayload(criteria: CriterionState[]): RubricCriterion[] {
  return criteria.map((c) => ({
    name: c.name,
    descriptors_by_score: Object.fromEntries(c.rows.map((r) => [r.score, r.text])),
  }));
}

const initialState: RubricFormState = {};

export function RubricForm({
  rubricId,
  initial,
  canCreatePlatform,
  editingPlatform,
  today,
  cancelHref,
  extraActions,
}: Props) {
  const t = useTranslations("rubricForm");
  const tCommon = useTranslations("common");
  const tExams = useTranslations("exams");
  const baseId = useId();
  const [state, formAction, pending] = useActionState(saveRubric, initialState);

  const { criteria: initialCriteria, ...initialFields } = initial;
  const [values, setValues] = useState<FieldValues>(initialFields);
  const [criteria, setCriteria] = useState<CriterionState[]>(() => toState(initialCriteria));
  const [platform, setPlatform] = useState(false);
  const set = <K extends keyof FieldValues>(key: K, value: FieldValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const scale = {
    min: Number(values.scaleMin),
    max: Number(values.scaleMax),
    step: Number(values.scaleStep),
  };
  const scaleFilled = values.scaleMin !== "" && values.scaleMax !== "" && values.scaleStep !== "";
  const points = useMemo(
    () => (scaleFilled ? scaleKeyList(scale.min, scale.max, scale.step) : []),
    [scaleFilled, scale.min, scale.max, scale.step],
  );
  const wholePoints = useMemo(() => scorePointsForEditor(points), [points]);

  const errors = state.fieldErrors ?? {};
  const err = (field: RubricField) => {
    const key = errors[field];
    return key ? t(`errors.${key}`) : undefined;
  };
  const optional = (label: string) => `${label} ${tCommon("optional")}`;

  // --- criteria editing ----------------------------------------------------
  const updateCriterion = (key: string, change: (c: CriterionState) => CriterionState) =>
    setCriteria((list) => list.map((c) => (c.key === key ? change(c) : c)));

  const addRows = (key: string, scores: string[]) =>
    updateCriterion(key, (c) => {
      const existing = new Set(c.rows.map((r) => r.score));
      const added = scores.filter((s) => !existing.has(s)).map((score) => ({ key: nextKey(), score, text: "" }));
      const rows = [...c.rows, ...added];
      const order = sortScoresDesc(rows.map((r) => r.score));
      return { ...c, rows: order.map((s) => rows.find((r) => r.score === s)!) };
    });

  return (
    <form action={formAction} className="grid gap-8" noValidate>
      {rubricId && <input type="hidden" name="id" value={rubricId} />}
      <input type="hidden" name="criteria" value={JSON.stringify(toPayload(criteria))} />

      {editingPlatform && (
        <p className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          {t("editingPlatformNote")}
        </p>
      )}

      {/* Basics */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="exam" label={t("examLabel")} error={err("exam")}>
          <NativeSelect
            id="exam"
            name="exam"
            value={values.exam}
            onChange={(e) => set("exam", e.target.value as Exam)}
            aria-invalid={!!errors.exam || undefined}
            aria-describedby={describedBy("exam", err("exam"))}
          >
            {EXAMS.map((exam) => (
              <option key={exam} value={exam}>
                {tExams(exam)}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field id="taskType" label={t("taskTypeLabel")} error={err("taskType")}>
          <Input
            id="taskType"
            name="taskType"
            maxLength={RUBRIC_LIMITS.taskType}
            placeholder={t("taskTypePlaceholder")}
            value={values.taskType}
            onChange={(e) => set("taskType", e.target.value)}
            aria-invalid={!!errors.taskType || undefined}
            aria-describedby={describedBy("taskType", err("taskType"))}
            required
          />
        </Field>

        <Field id="name" label={t("nameLabel")} error={err("name")}>
          <Input
            id="name"
            name="name"
            maxLength={RUBRIC_LIMITS.name}
            placeholder={t("namePlaceholder")}
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            aria-invalid={!!errors.name || undefined}
            aria-describedby={describedBy("name", err("name"))}
            required
          />
        </Field>

        <Field id="version" label={t("versionLabel")} error={err("version")}>
          <Input
            id="version"
            name="version"
            maxLength={RUBRIC_LIMITS.version}
            placeholder={t("versionPlaceholder")}
            value={values.version}
            onChange={(e) => set("version", e.target.value)}
            aria-invalid={!!errors.version || undefined}
            aria-describedby={describedBy("version", err("version"))}
            required
          />
        </Field>
      </div>

      {/* Scale + overall rule */}
      <fieldset className="grid gap-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">{t("scaleSection")}</legend>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["scaleMin", t("scaleMinLabel")],
              ["scaleMax", t("scaleMaxLabel")],
              ["scaleStep", t("scaleStepLabel")],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="grid gap-2">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                name={key}
                type="number"
                step="any"
                inputMode="decimal"
                value={values[key]}
                onChange={(e) => set(key, e.target.value)}
                aria-invalid={!!errors.scale || undefined}
                aria-describedby={errors.scale ? "scale-error" : undefined}
                required
              />
            </div>
          ))}
        </div>
        <FieldError id="scale-error" message={err("scale")} />

        <Field id="overallRule" label={t("overallRuleLabel")} error={err("overallRule")}>
          <Textarea
            id="overallRule"
            name="overallRule"
            rows={2}
            maxLength={RUBRIC_LIMITS.overallRule}
            placeholder={t("overallRulePlaceholder")}
            value={values.overallRule}
            onChange={(e) => set("overallRule", e.target.value)}
            aria-invalid={!!errors.overallRule || undefined}
            aria-describedby={describedBy("overallRule", err("overallRule"))}
            required
          />
        </Field>
      </fieldset>

      {/* Source + verification */}
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Field id="sourceUrl" label={optional(t("sourceUrlLabel"))} error={err("sourceUrl")}>
          <Input
            id="sourceUrl"
            name="sourceUrl"
            type="url"
            inputMode="url"
            maxLength={RUBRIC_LIMITS.url}
            placeholder="https://"
            value={values.sourceUrl}
            onChange={(e) => set("sourceUrl", e.target.value)}
            aria-invalid={!!errors.sourceUrl || undefined}
            aria-describedby={describedBy("sourceUrl", err("sourceUrl"))}
          />
        </Field>
        <div className="grid gap-2">
          <Label htmlFor="lastVerified">{optional(t("lastVerifiedLabel"))}</Label>
          <div className="flex gap-2">
            <Input
              id="lastVerified"
              name="lastVerified"
              type="date"
              max={today}
              value={values.lastVerified}
              onChange={(e) => set("lastVerified", e.target.value)}
              aria-invalid={!!errors.lastVerified || undefined}
              aria-describedby={describedBy("lastVerified", err("lastVerified"), t("lastVerifiedHint"))}
            />
            <Button type="button" variant="outline" onClick={() => set("lastVerified", today)}>
              {t("today")}
            </Button>
          </div>
          <p id="lastVerified-hint" className="text-sm text-muted-foreground">
            {t("lastVerifiedHint")}
          </p>
          <FieldError id="lastVerified-error" message={err("lastVerified")} />
        </div>
      </div>

      {canCreatePlatform && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
          <Checkbox checked={platform} onCheckedChange={(v) => setPlatform(v === true)} className="mt-0.5" />
          <span className="grid gap-0.5">
            <span className="text-sm font-medium">{t("platformLabel")}</span>
            <span className="text-xs text-muted-foreground">{t("platformHint")}</span>
          </span>
          {platform && <input type="hidden" name="platform" value="on" />}
        </label>
      )}

      {/* Criteria */}
      <section className="grid gap-4" aria-labelledby={`${baseId}-criteria`}>
        <div className="grid gap-1">
          <h2 id={`${baseId}-criteria`} className="font-semibold">
            {t("criteriaSection")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("descriptorsHint")}</p>
        </div>

        {criteria.map((criterion, ci) => {
          const nameId = `${baseId}-c${ci}-name`;
          const remaining = points.filter((p) => !criterion.rows.some((r) => r.score === p));
          const missingWhole = wholePoints.filter((p) => !criterion.rows.some((r) => r.score === p));
          return (
            <div key={criterion.key} className="grid gap-4 rounded-xl border bg-card p-4">
              <div className="flex items-end gap-2">
                <div className="grid flex-1 gap-2">
                  <Label htmlFor={nameId}>{t("criterionLabel", { number: ci + 1 })}</Label>
                  <Input
                    id={nameId}
                    maxLength={RUBRIC_LIMITS.criterionName}
                    placeholder={t("criterionNamePlaceholder")}
                    value={criterion.name}
                    onChange={(e) => updateCriterion(criterion.key, (c) => ({ ...c, name: e.target.value }))}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("removeCriterion")}
                  title={t("removeCriterion")}
                  disabled={criteria.length === 1}
                  onClick={() => setCriteria((list) => list.filter((c) => c.key !== criterion.key))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>

              <div className="grid gap-3">
                <span className="text-sm font-medium">{t("descriptorsLabel")}</span>
                {criterion.rows.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("noRows")}</p>
                )}
                {criterion.rows.map((row, ri) => {
                  const rowId = `${baseId}-c${ci}-r${ri}`;
                  const off = scaleFilled && !isOnScale(Number(row.score), scale.min, scale.max, scale.step);
                  return (
                    <div key={row.key} className="grid gap-2 sm:grid-cols-[5rem_1fr_auto] sm:items-start">
                      <Label htmlFor={rowId} className="flex-col items-start gap-1 sm:pt-2">
                        <span className="tabular-nums">{t("scoreRow", { score: row.score })}</span>
                        {off && (
                          <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                            {t("offScale")}
                          </span>
                        )}
                      </Label>
                      <Textarea
                        id={rowId}
                        rows={2}
                        maxLength={RUBRIC_LIMITS.descriptor}
                        value={row.text}
                        onChange={(e) =>
                          updateCriterion(criterion.key, (c) => ({
                            ...c,
                            rows: c.rows.map((r) => (r.key === row.key ? { ...r, text: e.target.value } : r)),
                          }))
                        }
                        className={cn(off && "border-destructive")}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("removeRow")}
                        title={t("removeRow")}
                        onClick={() =>
                          updateCriterion(criterion.key, (c) => ({
                            ...c,
                            rows: c.rows.filter((r) => r.key !== row.key),
                          }))
                        }
                      >
                        <X aria-hidden />
                      </Button>
                    </div>
                  );
                })}

                <div className="flex flex-wrap items-center gap-2">
                  {missingWhole.length > 0 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => addRows(criterion.key, missingWhole)}>
                      <Plus aria-hidden />
                      {t("addWholeScores")}
                    </Button>
                  )}
                  {remaining.length > 0 && remaining.length <= 201 && (
                    <AddScoreRow
                      label={t("addScoreLabel")}
                      buttonLabel={t("addScore")}
                      options={sortScoresDesc(remaining)}
                      onAdd={(score) => addRows(criterion.key, [score])}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <FieldError message={err("criteria")} />

        {criteria.length < RUBRIC_LIMITS.criteria && (
          <Button
            type="button"
            variant="outline"
            className="justify-self-start"
            onClick={() => setCriteria((list) => [...list, { key: nextKey(), name: "", rows: [] }])}
          >
            <Plus aria-hidden />
            {t("addCriterion")}
          </Button>
        )}
      </section>

      <FieldError message={state.formError && t(`errors.${state.formError}`)} />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {pending ? tCommon("saving") : rubricId ? t("submitUpdate") : t("submitCreate")}
        </Button>
        <Button asChild variant="outline">
          <Link href={cancelHref}>{tCommon("cancel")}</Link>
        </Button>
        {extraActions && <div className="ml-auto">{extraActions}</div>}
      </div>
    </form>
  );
}

function AddScoreRow({
  label,
  buttonLabel,
  options,
  onAdd,
}: {
  label: string;
  buttonLabel: string;
  options: string[];
  onAdd: (score: string) => void;
}) {
  const [score, setScore] = useState(options[0]);
  const current = options.includes(score) ? score : options[0];
  return (
    <div className="flex items-center gap-1">
      <NativeSelect
        aria-label={label}
        value={current}
        onChange={(e) => setScore(e.target.value)}
        className="h-8 w-24"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </NativeSelect>
      <Button type="button" variant="ghost" size="sm" onClick={() => onAdd(current)}>
        <Plus aria-hidden />
        {buttonLabel}
      </Button>
    </div>
  );
}
