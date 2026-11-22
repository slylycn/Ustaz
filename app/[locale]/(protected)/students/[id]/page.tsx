import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { BookPlus, CalendarPlus, ChevronRight, FilePlus2, Pencil, Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { requireTutor } from "@/lib/auth";
import { getStudent, listApprovedGrades, listStudentHomework, listStudentLessons, listStudentReports } from "@/lib/data";
import { STUDENT_TABS, type Lesson, type StudentTab } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { LessonRow } from "@/components/lesson-row";
import { PageHeader } from "@/components/page-header";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { ReportStatusBadge } from "@/components/report-status-badge";
import { addDays, zonedToUtc } from "@/lib/time";

export default async function StudentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  await requireTutor();

  const { id } = await params;
  const student = await getStudent(id);
  if (!student) notFound();

  const { tab: tabParam } = await searchParams;
  const tab: StudentTab = (STUDENT_TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as StudentTab)
    : "lessons";

  const t = await getTranslations("studentProfile");
  const tStudents = await getTranslations("students");
  const tCommon = await getTranslations("common");
  const tExams = await getTranslations("exams");
  const tLang = await getTranslations("outputLanguages");

  const profileHref = `/students/${student.id}`;
  const none = tCommon("none");

  const details: { label: string; value: React.ReactNode }[] = [
    { label: tStudents("columns.exam"), value: tExams(student.exam_track) },
    { label: tStudents("columns.grade"), value: student.grade_or_age ?? none },
    { label: tStudents("columns.target"), value: student.target_score ?? none },
    { label: t("parent"), value: student.parent_name ?? none },
    {
      label: t("parentPhone"),
      value: student.parent_phone ? (
        <a href={`tel:${student.parent_phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 text-primary hover:underline">
          <Phone className="size-3.5" aria-hidden />
          {student.parent_phone}
        </a>
      ) : (
        none
      ),
    },
    { label: t("parentLanguage"), value: tLang(student.parent_language) },
  ];

  return (
    <div className="grid gap-6">
      <PageHeader
        title={student.full_name}
        backHref="/students"
        backLabel={tStudents("title")}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`${profileHref}/edit`}>
                <Pencil aria-hidden />
                {tCommon("edit")}
              </Link>
            </Button>
            <Button asChild>
              <Link
                href={{
                  pathname: "/timetable/new",
                  query: { student: student.id, returnTo: profileHref },
                }}
              >
                <CalendarPlus aria-hidden />
                {t("addLesson")}
              </Link>
            </Button>
          </>
        }
      />

      <Card className="py-4">
        <CardContent className="grid gap-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {details.map((d) => (
              <div key={d.label} className="grid gap-0.5">
                <dt className="text-muted-foreground">{d.label}</dt>
                <dd className="font-medium">{d.value}</dd>
              </div>
            ))}
          </dl>
          {student.notes && (
            <div className="grid gap-0.5 border-t pt-3 text-sm">
              <span className="text-muted-foreground">{t("notes")}</span>
              <p className="whitespace-pre-line">{student.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <nav aria-label={t("tabsLabel")} className="-mb-2 flex gap-1 overflow-x-auto border-b">
        {STUDENT_TABS.map((key) => {
          const active = key === tab;
          return (
            <Link
              key={key}
              href={key === "lessons" ? profileHref : { pathname: profileHref, query: { tab: key } }}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`tabs.${key}`)}
            </Link>
          );
        })}
      </nav>

      {tab === "lessons" ? (
        <LessonsTab studentId={student.id} returnTo={profileHref} />
      ) : tab === "grades" ? (
        <GradesTab studentId={student.id} />
      ) : tab === "homework" ? (
        <HomeworkTab studentId={student.id} />
      ) : (
        <ReportsTab studentId={student.id} />
      )}
    </div>
  );
}

async function LessonsTab({ studentId, returnTo }: { studentId: string; returnTo: string }) {
  const t = await getTranslations("studentProfile");
  const lessons = await listStudentLessons(studentId); // newest first
  const now = Date.now();

  const upcoming = lessons.filter((l) => new Date(l.starts_at).getTime() >= now).reverse(); // soonest first
  const past = lessons.filter((l) => new Date(l.starts_at).getTime() < now);
  const attended = past.filter((l) => l.attended === true).length;
  const missed = past.filter((l) => l.attended === false).length;

  if (lessons.length === 0) {
    return <EmptyState title={t("noLessons")} body={t("noLessonsBody")} />;
  }

  return (
    <div className="grid gap-6">
      <LessonSection title={t("upcoming")} lessons={upcoming} emptyText={t("noUpcoming")} returnTo={returnTo} />
      <LessonSection
        title={t("past")}
        subtitle={past.length > 0 ? t("attendanceSummary", { attended, missed }) : undefined}
        lessons={past}
        emptyText={t("noPast")}
        returnTo={returnTo}
      />
    </div>
  );
}

function LessonSection({
  title,
  subtitle,
  lessons,
  emptyText,
  returnTo,
}: {
  title: string;
  subtitle?: string;
  lessons: Lesson[];
  emptyText: string;
  returnTo: string;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
      </div>
      {lessons.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="grid gap-2">
          {lessons.map((lesson) => (
            <LessonRow key={lesson.id} lesson={lesson} showDate returnTo={returnTo} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Only APPROVED submissions count as grades (final_result reviewed by the tutor). */
async function GradesTab({ studentId }: { studentId: string }) {
  const t = await getTranslations("studentProfile");
  const tSub = await getTranslations("submission");
  const format = await getFormatter();
  const grades = await listApprovedGrades(studentId);
  const returnTo = `/students/${studentId}?tab=grades`;

  const newButton = (
    <Button asChild variant="outline" size="sm">
      <Link href={{ pathname: "/submissions/new", query: { student: studentId, returnTo } }}>
        <FilePlus2 aria-hidden />
        {t("newSubmission")}
      </Link>
    </Button>
  );

  if (grades.length === 0) {
    return <EmptyState title={t("noGrades")} body={t("noGradesBody")} action={newButton} />;
  }

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{t("approvedGrades")}</h2>
        {newButton}
      </div>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {grades.map((g) => (
          <li key={g.id}>
            <Link href={`/submissions/${g.id}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent">
              <span className="w-14 shrink-0 text-2xl font-semibold tabular-nums">{g.final_result?.overall}</span>
              <div className="grid min-w-0 flex-1 gap-0.5">
                <span className="font-medium">{g.rubric_snapshot?.name ?? tSub("noRubric")}</span>
                <span className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                  {g.approved_at && <span>{format.dateTime(new Date(g.approved_at), { day: "numeric", month: "short", year: "numeric" })}</span>}
                  <span className="truncate">{g.task_prompt}</span>
                </span>
                <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  {g.final_result?.criteria.map((c) => (
                    <span key={c.name}>
                      {c.name}: <span className="font-medium text-foreground tabular-nums">{c.score}</span>
                    </span>
                  ))}
                </span>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function HomeworkTab({ studentId }: { studentId: string }) {
  const t = await getTranslations("studentProfile");
  const tHw = await getTranslations("homework");
  const format = await getFormatter();
  const homework = await listStudentHomework(studentId);
  const returnTo = `/students/${studentId}?tab=homework`;

  const newButton = (
    <Button asChild variant="outline" size="sm">
      <Link href={{ pathname: "/homework/new", query: { student: studentId, returnTo } }}>
        <BookPlus aria-hidden />
        {t("newHomework")}
      </Link>
    </Button>
  );

  if (homework.length === 0) {
    return <EmptyState title={t("noHomework")} body={t("noHomeworkBody")} action={newButton} />;
  }

  return (
    <section className="grid gap-3">
      <div className="flex justify-end">{newButton}</div>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {homework.map((h) => (
          <li key={h.id}>
            <Link href={`/homework/${h.id}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent">
              <div className="grid min-w-0 flex-1 gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{h.title}</span>
                  <HomeworkStatusBadge status={h.status} />
                </div>
                <span className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                  <span>{tHw("itemCount", { count: h.student_sheet.items.length })}</span>
                  {h.due_date && (
                    <span>{tHw("due", { date: format.dateTime(zonedToUtc(h.due_date, "12:00"), { day: "numeric", month: "short" }) })}</span>
                  )}
                </span>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function ReportsTab({ studentId }: { studentId: string }) {
  const t = await getTranslations("studentProfile");
  const format = await getFormatter();
  const reports = await listStudentReports(studentId);
  const noon = (key: string) => zonedToUtc(key, "12:00");

  const goButton = (
    <Button asChild variant="outline" size="sm">
      <Link href="/reports">{t("goToReports")}</Link>
    </Button>
  );

  if (reports.length === 0) {
    return <EmptyState title={t("noReports")} body={t("noReportsBody")} action={goButton} />;
  }

  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {reports.map((r) => (
        <li key={r.id}>
          <Link href={`/reports/${r.id}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent">
            <div className="grid min-w-0 flex-1 gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {format.dateTimeRange(noon(r.week_start), noon(addDays(r.week_start, 6)), { day: "numeric", month: "short" })}
                </span>
                <ReportStatusBadge status={r.status === "draft" && r.ai_status === "needs_data" ? "needs_data" : r.status} />
              </div>
              {r.message && <span className="line-clamp-1 text-sm text-muted-foreground">{r.message}</span>}
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
