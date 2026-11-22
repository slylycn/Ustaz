import { useTranslations } from "next-intl";
import type { ReportStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STYLES: Record<ReportStatus | "needs_data" | "none", string> = {
  none: "bg-muted text-muted-foreground",
  needs_data: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
  draft: "bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200",
  approved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200",
  sent: "bg-primary/10 text-primary",
};

/** "needs_data" is a draft whose AI result asked for more data; "none" = no report yet. */
export function ReportStatusBadge({ status }: { status: ReportStatus | "needs_data" | "none" }) {
  const t = useTranslations("reports.status");
  return <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", STYLES[status])}>{t(status)}</span>;
}
