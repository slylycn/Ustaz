import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { requireTutor } from "@/lib/auth";
import { listLessonsBetween } from "@/lib/data";
import { addDays, isDateKey, startOfWeek, todayKey, zonedDateKey, zonedToUtc } from "@/lib/time";
import type { LessonWithStudent } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LessonRow } from "@/components/lesson-row";
import { PageHeader } from "@/components/page-header";

export default async function TimetablePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  await requireTutor();

  const { week } = await searchParams;
  const today = todayKey(); // Asia/Almaty
  const weekStart = startOfWeek(isDateKey(week) ? week : today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isCurrentWeek = days.includes(today);

  const from = zonedToUtc(weekStart);
  const to = zonedToUtc(addDays(weekStart, 7));
  const lessons = await listLessonsBetween(from.toISOString(), to.toISOString());

  const byDay = new Map<string, LessonWithStudent[]>();
  for (const lesson of lessons) {
    const key = zonedDateKey(new Date(lesson.starts_at));
    byDay.set(key, [...(byDay.get(key) ?? []), lesson]);
  }

  const t = await getTranslations("timetable");
  const format = await getFormatter();
  const noon = (key: string) => zonedToUtc(key, "12:00"); // safe instant inside that Almaty day
  const weekLabel = format.dateTimeRange(noon(weekStart), noon(days[6]), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const returnTo = `/timetable?week=${weekStart}`;
  const newLessonHref = (date: string) => ({
    pathname: "/timetable/new",
    query: { date, returnTo },
  });

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t("title")}
        description={
          <>
            {weekLabel} · {t("weekSummary", { count: lessons.length })}
            <span className="block text-xs">{t("timeZoneNote")}</span>
          </>
        }
        actions={
          <Button asChild>
            <Link href={newLessonHref(isCurrentWeek ? today : weekStart)}>
              <Plus aria-hidden />
              {t("addLesson")}
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={{ pathname: "/timetable", query: { week: addDays(weekStart, -7) } }}>
            <ChevronLeft aria-hidden />
            {t("prevWeek")}
          </Link>
        </Button>
        {!isCurrentWeek && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/timetable">{t("thisWeek")}</Link>
          </Button>
        )}
        <Button asChild variant="outline" size="sm">
          <Link href={{ pathname: "/timetable", query: { week: addDays(weekStart, 7) } }}>
            {t("nextWeek")}
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4">
        {days.map((day) => {
          const dayLessons = byDay.get(day) ?? [];
          const isToday = day === today;
          return (
            <section
              key={day}
              aria-labelledby={`day-${day}`}
              className={cn(
                "grid gap-3 rounded-xl border bg-card p-4",
                isToday && "border-primary/50 ring-1 ring-primary/20",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 id={`day-${day}`} className="flex items-center gap-2 font-semibold">
                  <span className="inline-block first-letter:uppercase">
                    {format.dateTime(noon(day), { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                  {isToday && (
                    <span className="rounded-md bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
                      {t("today")}
                    </span>
                  )}
                </h2>
                <Button asChild variant="ghost" size="icon">
                  <Link href={newLessonHref(day)} aria-label={t("addOnDay")} title={t("addOnDay")}>
                    <Plus aria-hidden />
                  </Link>
                </Button>
              </div>

              {dayLessons.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noLessons")}</p>
              ) : (
                <ul className="grid gap-2">
                  {dayLessons.map((lesson) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      student={lesson.student ? { id: lesson.student.id, name: lesson.student.full_name } : null}
                      returnTo={returnTo}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
