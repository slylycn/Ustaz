"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { setLessonAttendance } from "@/lib/actions/lessons";
import { cn } from "@/lib/utils";

/** Two buttons: attended / missed. Clicking the active one clears the mark. */
export function AttendanceToggle({
  lessonId,
  attended,
}: {
  lessonId: string;
  attended: boolean | null;
}) {
  const t = useTranslations("attendance");
  const [value, setValue] = useState(attended);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function choose(next: boolean) {
    const previous = value;
    const target = value === next ? null : next;
    setValue(target); // optimistic
    setFailed(false);
    startTransition(async () => {
      const result = await setLessonAttendance(lessonId, target).catch(() => ({ ok: false }));
      if (!result.ok) {
        setValue(previous);
        setFailed(true);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <div
        role="group"
        aria-label={t("label")}
        className="inline-flex rounded-md border bg-muted p-0.5"
        aria-busy={pending || undefined}
      >
        <button
          type="button"
          aria-pressed={value === true}
          onClick={() => choose(true)}
          className={cn(
            "inline-flex min-h-8 items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
            value === true
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Check className="size-3.5" aria-hidden />
          {t("attended")}
        </button>
        <button
          type="button"
          aria-pressed={value === false}
          onClick={() => choose(false)}
          className={cn(
            "inline-flex min-h-8 items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
            value === false
              ? "bg-destructive text-white shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <X className="size-3.5" aria-hidden />
          {t("missed")}
        </button>
      </div>
      {failed && (
        <span role="alert" className="text-xs text-destructive">
          {t("error")}
        </span>
      )}
    </div>
  );
}
