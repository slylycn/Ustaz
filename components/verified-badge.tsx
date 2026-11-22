import { getFormatter, getTranslations } from "next-intl/server";
import { AlertTriangle, BadgeCheck, CircleDashed } from "lucide-react";
import { addDays, todayKey, zonedToUtc } from "@/lib/time";
import { cn } from "@/lib/utils";

/** "Last verified: 22 Nov 2026" — amber if never verified or older than a year. */
export async function VerifiedBadge({
  lastVerified,
  showStaleHint = false,
  className,
}: {
  lastVerified: string | null;
  showStaleHint?: boolean;
  className?: string;
}) {
  const t = await getTranslations("rubrics");

  if (!lastVerified) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
          className,
        )}
      >
        <CircleDashed className="size-3.5" aria-hidden />
        {t("notVerified")}
      </span>
    );
  }

  const format = await getFormatter();
  const date = format.dateTime(zonedToUtc(lastVerified, "12:00"), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const stale = lastVerified < addDays(todayKey(), -365);

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
          stale
            ? "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
            : "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200",
        )}
      >
        {stale ? <AlertTriangle className="size-3.5" aria-hidden /> : <BadgeCheck className="size-3.5" aria-hidden />}
        {t("lastVerified", { date })}
      </span>
      {stale && showStaleHint && <span className="text-xs text-muted-foreground">{t("stale")}</span>}
    </span>
  );
}
