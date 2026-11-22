"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Copy, Link2, Loader2, MessageCircle, PencilLine, RefreshCw, Sparkles } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { draftReport, listDraftTargets, markReportSent, reopenReport, resetShareLink } from "@/lib/actions/reports";
import { Button } from "@/components/ui/button";

const CONCURRENCY = 2;

/**
 * Drafts reports one student at a time (2 in parallel) by calling the server per student,
 * so a long list never hits a server time limit and the tutor sees progress.
 * Without studentIds it drafts every student that doesn't have an approved/sent report.
 */
export function DraftReportsButton({
  week,
  studentIds,
  label,
  variant = "default",
  confirmMessage,
}: {
  week: string;
  studentIds?: string[];
  label: string;
  variant?: "default" | "outline";
  /** Ask before running (e.g. when it replaces an edited draft). */
  confirmMessage?: string;
}) {
  const t = useTranslations("reports.draft");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  function run() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setErrors([]);
    startTransition(async () => {
      let ids: string[];
      try {
        ids = studentIds ?? (await listDraftTargets(week));
      } catch {
        setErrors([tCommon("unexpectedError")]);
        return;
      }
      setProgress({ done: 0, total: ids.length });
      const queue = [...ids];
      const failures: string[] = [];
      let done = 0;

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
          for (let id = queue.shift(); id; id = queue.shift()) {
            try {
              const result = await draftReport(id, week);
              if (!result.ok) failures.push(result.message);
            } catch {
              failures.push(tCommon("unexpectedError"));
            }
            done += 1;
            setProgress({ done, total: ids.length });
          }
        }),
      );

      setErrors([...new Set(failures)]);
      setProgress(null);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant={variant} disabled={pending} onClick={run}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
          {label}
        </Button>
        {progress && (
          <span role="status" className="text-sm text-muted-foreground tabular-nums">
            {t("progress", { done: progress.done, total: progress.total })}
          </span>
        )}
      </div>
      {errors.map((message) => (
        <p key={message} role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ))}
    </div>
  );
}

/** wa.me wants digits with country code. Kazakhstan: "8 7xx…" → "7 7xx…". */
function whatsappNumber(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

export function ShareActions({
  reportId,
  shareUrl,
  whatsappText,
  parentPhone,
}: {
  reportId: string;
  shareUrl: string;
  whatsappText: string;
  parentPhone: string | null;
}) {
  const t = useTranslations("reports.share");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const number = parentPhone ? whatsappNumber(parentPhone) : null;

  async function copy(text: string, message: string, markSent: boolean) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(message);
      if (markSent) startTransition(async () => {
        await markReportSent(reportId);
        router.refresh();
      });
    } catch {
      setNotice(t("copyFailed"));
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => copy(whatsappText, t("copied"), true)}>
          <Copy aria-hidden />
          {t("copyWhatsapp")}
        </Button>
        {number && (
          <Button asChild variant="outline">
            <a
              href={`https://wa.me/${number}?text=${encodeURIComponent(whatsappText)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                startTransition(async () => {
                  await markReportSent(reportId);
                  router.refresh();
                })
              }
            >
              <MessageCircle aria-hidden />
              {t("openWhatsapp")}
            </a>
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => copy(shareUrl, t("linkCopied"), false)}>
          <Link2 aria-hidden />
          {t("copyLink")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(t("resetConfirm"))) return;
            startTransition(async () => {
              await resetShareLink(reportId);
              setNotice(t("resetDone"));
              router.refresh();
            });
          }}
        >
          <RefreshCw aria-hidden />
          {t("resetLink")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(t("reopenConfirm"))) return;
            startTransition(async () => {
              await reopenReport(reportId);
              router.refresh();
            });
          }}
        >
          <PencilLine aria-hidden />
          {t("reopen")}
        </Button>
      </div>

      {notice && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
          {notice}
        </p>
      )}
    </div>
  );
}
