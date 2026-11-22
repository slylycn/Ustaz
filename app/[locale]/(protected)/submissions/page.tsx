import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronRight, Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { requireTutor } from "@/lib/auth";
import { listSubmissions } from "@/lib/data";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SubmissionStatusBadge } from "@/components/submission-status-badge";

export default async function SubmissionsPage({
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
  const status = (SUBMISSION_STATUSES as readonly string[]).includes(statusParam ?? "")
    ? (statusParam as SubmissionStatus)
    : undefined;

  const submissions = await listSubmissions(status);
  const t = await getTranslations("submission");
  const tStatus = await getTranslations("submission.status");
  const format = await getFormatter();

  const filters: { key: SubmissionStatus | undefined; label: string }[] = [
    { key: undefined, label: t("list.all") },
    ...SUBMISSION_STATUSES.map((s) => ({ key: s, label: tStatus(s) })),
  ];

  const addButton = (
    <Button asChild>
      <Link href="/submissions/new">
        <Plus aria-hidden />
        {t("list.add")}
      </Link>
    </Button>
  );

  return (
    <div className="grid gap-6">
      <PageHeader title={t("list.title")} description={t("list.subtitle")} actions={addButton} />

      <nav aria-label={t("list.filterLabel")} className="flex flex-wrap gap-1">
        {filters.map((f) => (
          <Link
            key={f.key ?? "all"}
            href={f.key ? { pathname: "/submissions", query: { status: f.key } } : "/submissions"}
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

      {submissions.length === 0 ? (
        <EmptyState title={t("list.emptyTitle")} body={t("list.emptyBody")} action={status ? undefined : addButton} />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {submissions.map((s) => (
            <li key={s.id}>
              <Link href={`/submissions/${s.id}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent">
                <div className="grid min-w-0 flex-1 gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s.student?.full_name ?? t("unknownStudent")}</span>
                    <SubmissionStatusBadge status={s.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span>{s.rubric?.name ?? s.rubric_snapshot?.name ?? t("noRubric")}</span>
                    <span>{format.dateTime(new Date(s.created_at), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="truncate">{s.task_prompt}</span>
                  </div>
                </div>
                {s.status === "approved" && s.final_result?.overall !== null && s.final_result?.overall !== undefined && (
                  <span className="text-lg font-semibold tabular-nums">{s.final_result.overall}</span>
                )}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
