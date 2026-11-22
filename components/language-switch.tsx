"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LanguageSwitch() {
  const t = useTranslations("topBar");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={t("language")}
      className="inline-flex rounded-md border bg-muted p-0.5"
    >
      {routing.locales.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            aria-pressed={active}
            disabled={isPending}
            onClick={() => {
              if (active) return;
              // Keeps the user on the same page; next-intl also remembers the choice in a cookie.
              startTransition(() => router.replace(pathname, { locale: l }));
            }}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-60",
              active
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`locales.${l}`)}
          </button>
        );
      })}
    </div>
  );
}
