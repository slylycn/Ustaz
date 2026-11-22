import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { requireTutor } from "@/lib/auth";
import { listReportsForWeek, listStudents } from "@/lib/data";
import { addDays, isDateKey, startOfWeek, todayKey, zonedToUtc } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { DraftReportsButton } from "@/components/report-buttons";
import { ReportStatusBadge } from "@/components/report-status-badge";

// Each student's draft is its own request, but allow slow Aqylbek calls anyway.
export const maxDuration = 300;

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  await requireTutor();

  const { week: weekParam } = await searchParams;
  const today = todayKey();
  const week = startOfWeek(isDateKey(weekParam) ? weekParam : today);
  const isCurrentWeek = week === startOfWeek(today);

  const [students, reports, t, tLang, format] = await Promise.all([
    listStudents(),
    listReportsForWeek(week),
    getTranslations("reports"),
    getTranslations("outputLanguages"),
    getFormatter(),
  ]);
  const byStudent = new Map(reports.map((r) => [r.student_id, r]));
  const noon = (key: string) => zonedToUtc(key, "12:00");
  const weekLabel = format.dateTimeRange(noon(week), noon(addDays(week, 6)), { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t("title")}
        description={<>{weekLabel} · {t("subtitle")}</>}
        actions={
          students.length > 0 ? (
            <DraftReportsButton week={week} label={isCurrentWeek ? t("draftThisWeek") : t("draftWeek")} />
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={{ pathname: "/reports", query: { week: addDays(week, -7) } }}>
            <ChevronLeft aria-hidden />
            {t("prevWeek")}
          </Link>
        </Button>
        {!isCurrentWeek && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/reports">{t("thisWeek")}</Link>
          </Button>
        )}
        <Button asChild variant="outline" size="sm">
          <Link href={{ pathname: "/reports", query: { week: addDays(week, 7) } }}>
            {t("nextWeek")}
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      </div>

      {students.length === 0 ? (
        <EmptyState title={t("noStudentsTitle")} body={t("noStudentsBody")} />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {students.map((student) => {
            const report = byStudent.get(student.id);
            const badge = !report
              ? "none"
              : report.status === "draft" && report.ai_status === "needs_data"
                ? "needs_data"
                : report.status;
            return (
              <li key={student.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="grid min-w-0 flex-1 gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{student.full_name}</span>
                    <ReportStatusBadge status={badge} />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {t("parentLine", {
                      parent: student.parent_name ?? t("parentUnknown"),
                      language: tLang(student.parent_language),
                    })}
                  </span>
                  {report?.message && (
                    <span className="line-clamp-1 text-sm text-muted-foreground">{report.message}</span>
                  )}
                </div>
                {report ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/reports/${report.id}`}>
                      {report.status === "draft" ? t("review") : t("open")}
                      <ChevronRight aria-hidden />
                    </Link>
                  </Button>
                ) : (
                  <DraftReportsButton week={week} studentIds={[student.id]} label={t("draftOne")} variant="outline" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
