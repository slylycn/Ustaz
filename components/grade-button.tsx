"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { gradeSubmission } from "@/lib/actions/submissions";
import { Button } from "@/components/ui/button";

/** "Grade with Aqylbek". With `regrade`, asks first because it replaces the current draft. */
export function GradeButton({ submissionId, regrade = false }: { submissionId: string; regrade?: boolean }) {
  const t = useTranslations("submission.grade");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant={regrade ? "outline" : "default"}
          disabled={pending}
          onClick={() => {
            if (regrade && !window.confirm(t("regradeConfirm"))) return;
            setError(null);
            startTransition(async () => {
              try {
                const result = await gradeSubmission(submissionId);
                if (result.ok) router.refresh();
                else setError(result.message);
              } catch {
                setError(tCommon("unexpectedError")); // network drop, timeout, server crash
              }
            });
          }}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
          {pending ? t("grading") : regrade ? t("regrade") : t("button")}
        </Button>
        {pending && <span className="text-sm text-muted-foreground">{t("wait")}</span>}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
