import { useTranslations } from "next-intl";
import type { HomeworkStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function HomeworkStatusBadge({ status }: { status: HomeworkStatus }) {
  const t = useTranslations("homework.status");
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
        status === "assigned"
          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200"
          : "bg-muted text-muted-foreground",
      )}
    >
      {t(status)}
    </span>
  );
}
