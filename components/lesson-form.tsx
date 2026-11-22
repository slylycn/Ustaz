"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { saveLesson, type LessonField, type LessonFormState } from "@/lib/actions/lessons";
import { LIMITS } from "@/lib/constants";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, FieldError, describedBy } from "@/components/form-field";

export type LessonFormValues = {
  studentId: string;
  /** Almaty calendar day, "YYYY-MM-DD". */
  date: string;
  /** Almaty wall-clock time, "HH:mm". */
  time: string;
  durationMin: string;
  topic: string;
  /** "" = not marked, "true" = attended, "false" = missed. */
  attended: "" | "true" | "false";
  tutorNote: string;
};

type Props = {
  lessonId?: string;
  students: { id: string; full_name: string }[];
  initial: LessonFormValues;
  returnTo: string;
  cancelHref: string;
  extraActions?: React.ReactNode;
};

const DURATIONS = [30, 45, 60, 90, 120];
const initialState: LessonFormState = {};

export function LessonForm({ lessonId, students, initial, returnTo, cancelHref, extraActions }: Props) {
  const t = useTranslations("lessonForm");
  const tCommon = useTranslations("common");
  const tAttendance = useTranslations("attendance");
  const [state, formAction, pending] = useActionState(saveLesson, initialState);

  const [values, setValues] = useState<LessonFormValues>(initial);
  const set = <K extends keyof LessonFormValues>(key: K, value: LessonFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const errors = state.fieldErrors ?? {};
  const err = (field: LessonField) => {
    const key = errors[field];
    return key ? t(`errors.${key}`) : undefined;
  };
  const optional = (label: string) => `${label} ${tCommon("optional")}`;

  // Keep a custom duration (e.g. 75) selectable when editing.
  const durationOptions = DURATIONS.includes(Number(initial.durationMin))
    ? DURATIONS
    : [...DURATIONS, Number(initial.durationMin)].sort((a, b) => a - b);

  return (
    <form action={formAction} className="grid gap-6" noValidate>
      {lessonId && <input type="hidden" name="id" value={lessonId} />}
      <input type="hidden" name="returnTo" value={returnTo} />

      <Field id="studentId" label={t("studentLabel")} error={err("studentId")}>
        <NativeSelect
          id="studentId"
          name="studentId"
          value={values.studentId}
          onChange={(e) => set("studentId", e.target.value)}
          aria-invalid={!!errors.studentId || undefined}
          aria-describedby={describedBy("studentId", err("studentId"))}
          required
        >
          <option value="" disabled>
            {t("studentPlaceholder")}
          </option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="date" label={t("dateLabel")} error={err("date")}>
          <Input
            id="date"
            name="date"
            type="date"
            value={values.date}
            onChange={(e) => set("date", e.target.value)}
            aria-invalid={!!errors.date || undefined}
            aria-describedby={describedBy("date", err("date"))}
            required
          />
        </Field>
        <Field id="time" label={t("timeLabel")} hint={t("timeZoneHint")} error={err("time")}>
          <Input
            id="time"
            name="time"
            type="time"
            step={300}
            value={values.time}
            onChange={(e) => set("time", e.target.value)}
            aria-invalid={!!errors.time || undefined}
            aria-describedby={describedBy("time", err("time"), t("timeZoneHint"))}
            required
          />
        </Field>
        <Field id="durationMin" label={t("durationLabel")} error={err("durationMin")}>
          <NativeSelect
            id="durationMin"
            name="durationMin"
            value={values.durationMin}
            onChange={(e) => set("durationMin", e.target.value)}
            aria-invalid={!!errors.durationMin || undefined}
            aria-describedby={describedBy("durationMin", err("durationMin"))}
          >
            {durationOptions.map((min) => (
              <option key={min} value={String(min)}>
                {tCommon("minutes", { count: min })}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Field id="topic" label={optional(t("topicLabel"))} error={err("topic")}>
        <Input
          id="topic"
          name="topic"
          maxLength={LIMITS.topic}
          placeholder={t("topicPlaceholder")}
          value={values.topic}
          onChange={(e) => set("topic", e.target.value)}
          aria-invalid={!!errors.topic || undefined}
          aria-describedby={describedBy("topic", err("topic"))}
        />
      </Field>

      <Field id="attended" label={t("attendedLabel")} error={err("attended")}>
        <NativeSelect
          id="attended"
          name="attended"
          value={values.attended}
          onChange={(e) => set("attended", e.target.value as LessonFormValues["attended"])}
          className="sm:max-w-60"
        >
          <option value="">{tAttendance("unmarked")}</option>
          <option value="true">{tAttendance("attended")}</option>
          <option value="false">{tAttendance("missed")}</option>
        </NativeSelect>
      </Field>

      <Field id="tutorNote" label={optional(t("noteLabel"))} error={err("tutorNote")}>
        <Textarea
          id="tutorNote"
          name="tutorNote"
          rows={3}
          maxLength={LIMITS.long}
          placeholder={t("notePlaceholder")}
          value={values.tutorNote}
          onChange={(e) => set("tutorNote", e.target.value)}
          aria-invalid={!!errors.tutorNote || undefined}
          aria-describedby={describedBy("tutorNote", err("tutorNote"))}
        />
      </Field>

      <FieldError message={state.formError && t(`errors.${state.formError}`)} />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {pending ? tCommon("saving") : lessonId ? t("submitUpdate") : t("submitCreate")}
        </Button>
        <Button asChild variant="outline">
          <Link href={cancelHref}>{tCommon("cancel")}</Link>
        </Button>
        {extraActions && <div className="ml-auto">{extraActions}</div>}
      </div>
    </form>
  );
}
