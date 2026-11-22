import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, CalendarDays, ClipboardCheck, FileText, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { requireTutor } from "@/lib/auth";
import { getAiUsage, hasDemoStudents, listLessonsBetween, listReportsForWeek, listSubmissions } from "@/lib/data";
import { addDays, startOfWeek, todayKey, zonedToUtc } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoButtons } from "@/components/demo-buttons";
import { LessonRow } from "@/components/lesson-row";

const LIST_LIMIT = 5;

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  const tutor = await requireTutor();

  const today = todayKey(); // Asia/Almaty
  const week = startOfWeek(today);
  const monthStart = zonedToUtc(`${today.slice(0, 7)}-01`);

  const [lessons, toReview, notGraded, weekReports, usage, hasDemo, t, format] = await Promise.all([
    listLessonsBetween(zonedToUtc(today).toISOString(), zonedToUtc(addDays(today, 1)).toISOString()),
    listSubmissions("ai_done"),
    listSubmissions("draft"),
    listReportsForWeek(week),
    getAiUsage(monthStart.toISOString()),
    hasDemoStudents(),
    getTranslations("dashboard"),
    getFormatter(),
  ]);
  const toApprove = weekReports.filter((r) => r.status === "draft" && r.ai_status === "ok");
  const needsData = weekReports.filter((r) => r.status === "draft" && r.ai_status === "needs_data").length;
  const compact = (n: number) => format.number(n, { notation: "compact", maximumFractionDigits: 1 });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("greeting", { name: tutor.full_name })}</h1>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {format.dateTime(zonedToUtc(today, "12:00"), { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's lessons */}
        <Card className="gap-3 py-4 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" aria-hidden />
              {t("today.title")}
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/timetable">
                {t("today.all")}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {lessons.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("today.empty")}</p>
            ) : (
              <ul className="grid gap-2">
                {lessons.map((lesson) => (
                  <LessonRow
                    key={lesson.id}
                    lesson={lesson}
                    student={lesson.student ? { id: lesson.student.id, name: lesson.student.full_name } : null}
                    returnTo="/dashboard"
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Submissions waiting for review */}
        <Card className="gap-3 py-4">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="size-4 text-primary" aria-hidden />
              {t("review.title")}
              <Count n={toReview.length} />
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href={{ pathname: "/submissions", query: { status: "ai_done" } }}>
                {t("review.all")}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2">
            {toReview.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("review.empty")}</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {toReview.slice(0, LIST_LIMIT).map((s) => (
                  <li key={s.id}>
                    <Link href={`/submissions/${s.id}`} className="grid gap-0.5 px-3 py-2 text-sm hover:bg-accent">
                      <span className="font-medium">{s.student?.full_name}</span>
                      <span className="truncate text-muted-foreground">{s.rubric?.name ?? s.rubric_snapshot?.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {notGraded.length > 0 && (
              <Link href={{ pathname: "/submissions", query: { status: "draft" } }} className="text-sm text-muted-foreground hover:underline">
                {t("review.notGraded", { count: notGraded.length })}
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Reports to approve this week */}
        <Card className="gap-3 py-4">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-primary" aria-hidden />
              {t("reports.title")}
              <Count n={toApprove.length} />
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/reports">
                {t("reports.all")}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2">
            {toApprove.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("reports.empty")}</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {toApprove.slice(0, LIST_LIMIT).map((r) => (
                  <li key={r.id}>
                    <Link href={`/reports/${r.id}`} className="grid gap-0.5 px-3 py-2 text-sm hover:bg-accent">
                      <span className="font-medium">{r.student?.full_name}</span>
                      <span className="line-clamp-1 text-muted-foreground">{r.message}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {needsData > 0 && (
              <Link href="/reports" className="text-sm text-muted-foreground hover:underline">
                {t("reports.needsData", { count: needsData })}
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Aqylbek usage this month (from ai_runs) */}
        <Card className="gap-3 py-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" aria-hidden />
              {t("usage.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <div className="grid">
                <span className="text-3xl font-semibold tabular-nums">{usage.calls}</span>
                <span className="text-xs text-muted-foreground">{t("usage.calls")}</span>
              </div>
              <div className="grid">
                <span className="text-lg font-semibold tabular-nums">{compact(usage.inputTokens + usage.outputTokens)}</span>
                <span className="text-xs text-muted-foreground">
                  {t("usage.tokens", { input: compact(usage.inputTokens), output: compact(usage.outputTokens) })}
                </span>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-sm">
              {(["grade", "homework", "parent_report"] as const).map((mode) => (
                <div key={mode} className="grid rounded-lg bg-muted/60 px-2 py-1.5">
                  <dt className="text-xs text-muted-foreground">{t(`usage.modes.${mode}`)}</dt>
                  <dd className="font-medium tabular-nums">{usage.byMode[mode]}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">
              {t("usage.statuses", { ok: usage.ok, busy: usage.busy, failed: usage.failed })}
            </p>
          </CardContent>
        </Card>

        {/* Demo data */}
        <Card className="gap-3 border-dashed py-4 shadow-none">
          <CardHeader>
            <CardTitle>{t("demo.title")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm text-muted-foreground">{hasDemo ? t("demo.loadedBody") : t("demo.body")}</p>
            <DemoButtons hasDemo={hasDemo} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Count({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground tabular-nums">{n}</span>
  );
}
