import { useTranslations } from "next-intl";
import type { SubmissionStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STYLES: Record<SubmissionStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  ai_done: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
  approved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200",
};

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  const t = useTranslations("submission.status");
  return (
    <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", STYLES[status])}>
      {t(status)}
    </span>
  );
}
