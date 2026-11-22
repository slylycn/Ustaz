"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/** Catches unexpected errors on any signed-in page, in kk or ru, with a retry. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPage");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto grid max-w-md gap-4 py-16 text-center">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("body")}</p>
      {error.digest && <p className="text-xs text-muted-foreground">{t("code", { code: error.digest })}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={reset}>
          <RotateCcw aria-hidden />
          {t("retry")}
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">{t("home")}</Link>
        </Button>
      </div>
    </div>
  );
}
