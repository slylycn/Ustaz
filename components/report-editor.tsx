"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { saveReport, type ReportSaveState } from "@/lib/actions/reports";
import { REPORT_MESSAGE_MAX } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/form-field";

const initialState: ReportSaveState = {};

export function ReportEditor({ reportId, initialMessage }: { reportId: string; initialMessage: string }) {
  const t = useTranslations("reports.editor");
  const [state, formAction, pending] = useActionState(saveReport, initialState);
  const [message, setMessage] = useState(initialMessage);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="id" value={reportId} />
      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="message">{t("messageLabel")}</Label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("chars", { count: message.length, max: REPORT_MESSAGE_MAX })}
          </span>
        </div>
        <Textarea
          id="message"
          name="message"
          rows={12}
          maxLength={REPORT_MESSAGE_MAX}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>

      <FieldError message={state.error && t(`errors.${state.error}`)} />
      {state.saved && !pending && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
          {t("saved")}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="intent" value="approve" disabled={pending || !message.trim()}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
          {t("approve")}
        </Button>
        <Button type="submit" name="intent" value="save" variant="outline" disabled={pending}>
          <Save aria-hidden />
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
