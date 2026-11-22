import { getFormatter, getTranslations } from "next-intl/server";
import { Pencil } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Lesson } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { AttendanceToggle } from "@/components/attendance-toggle";

type Props = {
  lesson: Lesson;
  /** Shown on the timetable; omitted on a student's own profile. */
  student?: { id: string; name: string } | null;
  /** Show the date too (student profile lists span many days). */
  showDate?: boolean;
  /** Where the edit form should go back to, e.g. "/students/abc" (no locale prefix). */
  returnTo: string;
};

export async function LessonRow({ lesson, student, showDate = false, returnTo }: Props) {
  const format = await getFormatter(); // uses the Asia/Almaty time zone from i18n/request.ts
  const t = await getTranslations("timetable");
  const tCommon = await getTranslations("common");

  const start = new Date(lesson.starts_at);
  const end = new Date(start.getTime() + lesson.duration_min * 60_000);
  const timeRange = format.dateTimeRange(start, end, { hour: "2-digit", minute: "2-digit" });

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-background p-3">
      <div className="grid w-32 shrink-0 gap-0.5">
        {showDate && (
          <span className="text-xs font-medium text-muted-foreground">
            {format.dateTime(start, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
        <span className="text-sm font-semibold tabular-nums">{timeRange}</span>
        <span className="text-xs text-muted-foreground">
          {tCommon("minutes", { count: lesson.duration_min })}
        </span>
      </div>

      <div className="grid min-w-0 flex-1 basis-40 gap-0.5">
        {student && (
          <Link href={`/students/${student.id}`} className="truncate font-medium hover:underline">
            {student.name}
          </Link>
        )}
        {lesson.topic && (
          <span className={student ? "truncate text-sm text-muted-foreground" : "truncate font-medium"}>
            {lesson.topic}
          </span>
        )}
        {lesson.tutor_note && (
          <span className="line-clamp-2 text-xs text-muted-foreground">{lesson.tutor_note}</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <AttendanceToggle lessonId={lesson.id} attended={lesson.attended} />
        <Button asChild variant="ghost" size="icon">
          <Link
            href={{ pathname: `/timetable/${lesson.id}/edit`, query: { returnTo } }}
            aria-label={t("editTitle")}
            title={t("editTitle")}
          >
            <Pencil aria-hidden />
          </Link>
        </Button>
      </div>
    </li>
  );
}
