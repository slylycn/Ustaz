import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

/** Shown instantly while any signed-in page loads its data. */
export default function Loading() {
  const t = useTranslations("common");
  return (
    <div role="status" className="grid gap-4" aria-live="polite">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t("loading")}
      </span>
      <div className="h-8 w-1/3 animate-pulse rounded-md bg-muted" />
      <div className="h-32 animate-pulse rounded-xl bg-muted" />
      <div className="h-32 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
