import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronRight, Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { requireTutor } from "@/lib/auth";
import { listHomework } from "@/lib/data";
import { HOMEWORK_STATUSES, type HomeworkStatus } from "@/lib/constants";
import { zonedToUtc } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { PageHeader } from "@/components/page-header";

export default async function HomeworkListPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  await requireTutor();

  const { status: statusParam } = await searchParams;
  const status = (HOMEWORK_STATUSES as readonly string[]).includes(statusParam ?? "")
    ? (statusParam as HomeworkStatus)
    : undefined;

  const homework = await listHomework(status);
  const t = await getTranslations("homework");
  const tExams = await getTranslations("exams");
  const format = await getFormatter();

  const addButton = (
    <Button asChild>
      <Link href="/homework/new">
        <Plus aria-hidden />
        {t("list.add")}
      </Link>
    </Button>
  );
  const filters: { key?: HomeworkStatus; label: string }[] = [
    { label: t("list.all") },
    ...HOMEWORK_STATUSES.map((s) => ({ key: s, label: t(`status.${s}`) })),
  ];

  return (
    <div className="grid gap-6">
      <PageHeader title={t("list.title")} description={t("list.subtitle")} actions={addButton} />

      <nav aria-label={t("list.filterLabel")} className="flex flex-wrap gap-1">
        {filters.map((f) => (
          <Link
            key={f.key ?? "all"}
            href={f.key ? { pathname: "/homework", query: { status: f.key } } : "/homework"}
            aria-current={f.key === status ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              f.key === status ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {homework.length === 0 ? (
        <EmptyState title={t("list.emptyTitle")} body={t("list.emptyBody")} action={status ? undefined : addButton} />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {homework.map((h) => (
            <li key={h.id}>
              <Link href={`/homework/${h.id}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent">
                <div className="grid min-w-0 flex-1 gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{h.title}</span>
                    <HomeworkStatusBadge status={h.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span>{tExams(h.exam)}</span>
                    {h.level && <span>{h.level}</span>}
                    <span>{t("itemCount", { count: h.student_sheet.items.length })}</span>
                    <span>{h.student?.full_name ?? t("noStudent")}</span>
                    {h.due_date && (
                      <span>
                        {t("due", { date: format.dateTime(zonedToUtc(h.due_date, "12:00"), { day: "numeric", month: "short" }) })}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
