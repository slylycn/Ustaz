"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { saveStudent, type StudentField, type StudentFormState } from "@/lib/actions/students";
import { EXAMS, LIMITS, OUTPUT_LANGUAGES, isOutputLanguage, type Exam, type OutputLanguage } from "@/lib/constants";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Field, FieldError, describedBy } from "@/components/form-field";

export type StudentFormValues = {
  fullName: string;
  gradeOrAge: string;
  examTrack: Exam;
  targetScore: string;
  parentName: string;
  parentPhone: string;
  parentLanguage: OutputLanguage;
  notes: string;
};

type Props = {
  /** Present when editing. */
  studentId?: string;
  initial: StudentFormValues;
  cancelHref: string;
  /** Rendered next to the submit button (e.g. a delete button). */
  extraActions?: React.ReactNode;
};

const initialState: StudentFormState = {};

export function StudentForm({ studentId, initial, cancelHref, extraActions }: Props) {
  const t = useTranslations("studentForm");
  const tCommon = useTranslations("common");
  const tExams = useTranslations("exams");
  const tLang = useTranslations("outputLanguages");
  const [state, formAction, pending] = useActionState(saveStudent, initialState);

  // Controlled so values survive a failed submit.
  const [values, setValues] = useState<StudentFormValues>(initial);
  const set = <K extends keyof StudentFormValues>(key: K, value: StudentFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const errors = state.fieldErrors ?? {};
  const err = (field: StudentField) => {
    const key = errors[field];
    return key ? t(`errors.${key}`) : undefined;
  };
  const optional = (label: string) => `${label} ${tCommon("optional")}`;

  return (
    <form action={formAction} className="grid gap-6" noValidate>
      {studentId && <input type="hidden" name="id" value={studentId} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field id="fullName" label={t("fullNameLabel")} error={err("fullName")}>
            <Input
              id="fullName"
              name="fullName"
              maxLength={LIMITS.name}
              placeholder={t("fullNamePlaceholder")}
              value={values.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              aria-invalid={!!errors.fullName || undefined}
              aria-describedby={describedBy("fullName", err("fullName"))}
              required
            />
          </Field>
        </div>

        <Field id="examTrack" label={t("examLabel")} error={err("examTrack")}>
          <NativeSelect
            id="examTrack"
            name="examTrack"
            value={values.examTrack}
            onChange={(e) => set("examTrack", e.target.value as Exam)}
            aria-invalid={!!errors.examTrack || undefined}
            aria-describedby={describedBy("examTrack", err("examTrack"))}
          >
            {EXAMS.map((exam) => (
              <option key={exam} value={exam}>
                {tExams(exam)}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field id="gradeOrAge" label={optional(t("gradeLabel"))} error={err("gradeOrAge")}>
          <Input
            id="gradeOrAge"
            name="gradeOrAge"
            maxLength={LIMITS.short}
            placeholder={t("gradePlaceholder")}
            value={values.gradeOrAge}
            onChange={(e) => set("gradeOrAge", e.target.value)}
            aria-invalid={!!errors.gradeOrAge || undefined}
            aria-describedby={describedBy("gradeOrAge", err("gradeOrAge"))}
          />
        </Field>

        <Field id="targetScore" label={optional(t("targetLabel"))} error={err("targetScore")}>
          <Input
            id="targetScore"
            name="targetScore"
            maxLength={LIMITS.short}
            placeholder={t("targetPlaceholder")}
            value={values.targetScore}
            onChange={(e) => set("targetScore", e.target.value)}
            aria-invalid={!!errors.targetScore || undefined}
            aria-describedby={describedBy("targetScore", err("targetScore"))}
          />
        </Field>
      </div>

      <fieldset className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium">{t("parentSection")}</legend>

        <Field id="parentName" label={optional(t("parentNameLabel"))} error={err("parentName")}>
          <Input
            id="parentName"
            name="parentName"
            maxLength={LIMITS.name}
            value={values.parentName}
            onChange={(e) => set("parentName", e.target.value)}
            aria-invalid={!!errors.parentName || undefined}
            aria-describedby={describedBy("parentName", err("parentName"))}
          />
        </Field>

        <Field id="parentPhone" label={optional(t("parentPhoneLabel"))} error={err("parentPhone")}>
          <Input
            id="parentPhone"
            name="parentPhone"
            type="tel"
            inputMode="tel"
            maxLength={LIMITS.short}
            placeholder={t("parentPhonePlaceholder")}
            value={values.parentPhone}
            onChange={(e) => set("parentPhone", e.target.value)}
            aria-invalid={!!errors.parentPhone || undefined}
            aria-describedby={describedBy("parentPhone", err("parentPhone"))}
          />
        </Field>

        <div className="grid gap-3 sm:col-span-2">
          <p id="parentLanguage-label" className="text-sm font-medium">
            {t("parentLanguageLabel")}
          </p>
          <RadioGroup
            aria-labelledby="parentLanguage-label"
            aria-describedby="parentLanguage-hint"
            value={values.parentLanguage}
            onValueChange={(v) => isOutputLanguage(v) && set("parentLanguage", v)}
            className="flex flex-wrap gap-2"
          >
            {OUTPUT_LANGUAGES.map((lang) => (
              <label
                key={lang}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                  values.parentLanguage === lang && "border-primary bg-primary/5 hover:bg-primary/10",
                )}
              >
                <RadioGroupItem value={lang} />
                {tLang(lang)}
              </label>
            ))}
          </RadioGroup>
          <input type="hidden" name="parentLanguage" value={values.parentLanguage} />
          <p id="parentLanguage-hint" className="text-sm text-muted-foreground">
            {t("parentLanguageHint")}
          </p>
          <FieldError message={err("parentLanguage")} />
        </div>
      </fieldset>

      <Field id="notes" label={optional(t("notesLabel"))} error={err("notes")}>
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          maxLength={LIMITS.long}
          placeholder={t("notesPlaceholder")}
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          aria-invalid={!!errors.notes || undefined}
          aria-describedby={describedBy("notes", err("notes"))}
        />
      </Field>

      <FieldError message={state.formError && t(`errors.${state.formError}`)} />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {pending ? tCommon("saving") : studentId ? t("submitUpdate") : t("submitCreate")}
        </Button>
        <Button asChild variant="outline">
          <Link href={cancelHref}>{tCommon("cancel")}</Link>
        </Button>
        {extraActions && <div className="ml-auto">{extraActions}</div>}
      </div>
    </form>
  );
}
