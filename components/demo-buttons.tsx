"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Database, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { loadDemoData, removeDemoData } from "@/lib/actions/demo";
import { Button } from "@/components/ui/button";

export function DemoButtons({ hasDemo }: { hasDemo: boolean }) {
  const t = useTranslations("dashboard.demo");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) setError(result.error === "alreadyLoaded" ? t("alreadyLoaded") : tCommon("unexpectedError"));
        else router.refresh();
      } catch {
        setError(tCommon("unexpectedError"));
      }
    });
  };

  return (
    <div className="grid gap-2">
      {hasDemo ? (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => window.confirm(t("removeConfirm")) && run(removeDemoData)}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
          {pending ? t("removing") : t("remove")}
        </Button>
      ) : (
        <Button type="button" variant="outline" disabled={pending} onClick={() => run(loadDemoData)}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Database aria-hidden />}
          {pending ? t("loading") : t("load")}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
