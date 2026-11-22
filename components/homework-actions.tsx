"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Printer, RefreshCw, Send, Undo2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { assignHomework, regenerateHomework, unassignHomework } from "@/lib/actions/homework";
import { Button } from "@/components/ui/button";

function useAction() {
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<string | null>) => {
    setError(null);
    startTransition(async () => {
      try {
        const message = await fn();
        if (message) setError(message);
        else router.refresh();
      } catch {
        setError(tCommon("unexpectedError"));
      }
    });
  };
  return { pending, error, run };
}

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function AssignButton({ homeworkId }: { homeworkId: string }) {
  const t = useTranslations("homework.actions");
  const { pending, error, run } = useAction();
  return (
    <div className="grid gap-1">
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          run(async () => {
            const result = await assignHomework(homeworkId);
            return result.ok ? null : result.error === "needsStudent" ? t("needsStudent") : t("error");
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        {t("assign")}
      </Button>
      <ErrorText message={error} />
    </div>
  );
}

export function UnassignButton({ homeworkId }: { homeworkId: string }) {
  const t = useTranslations("homework.actions");
  const { pending, error, run } = useAction();
  return (
    <div className="grid gap-1">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => run(async () => ((await unassignHomework(homeworkId)).ok ? null : t("error")))}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Undo2 aria-hidden />}
        {t("unassign")}
      </Button>
      <ErrorText message={error} />
    </div>
  );
}

export function RegenerateButton({ homeworkId }: { homeworkId: string }) {
  const t = useTranslations("homework.actions");
  const { pending, error, run } = useAction();
  return (
    <div className="grid gap-1">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(t("regenerateConfirm"))) return;
          run(async () => {
            const result = await regenerateHomework(homeworkId);
            return result.ok ? null : result.message;
          });
        }}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
        {pending ? t("regenerating") : t("regenerate")}
      </Button>
      <ErrorText message={error} />
    </div>
  );
}

export function PrintButton() {
  const t = useTranslations("homework.print");
  return (
    <Button type="button" onClick={() => window.print()}>
      <Printer aria-hidden />
      {t("print")}
    </Button>
  );
}
