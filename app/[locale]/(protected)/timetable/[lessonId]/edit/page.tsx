import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { resolveLocale } from "@/i18n/locale";
import { requireTutor } from "@/lib/auth";
import { getLesson, listStudents } from "@/lib/data";
import { deleteLesson } from "@/lib/actions/lessons";
import { startOfWeek, zonedDateKey, zonedTime } from "@/lib/time";
import { safeReturnTo } from "@/lib/validation";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteButton } from "@/components/delete-button";
import { LessonForm } from "@/components/lesson-form";
import { PageHeader } from "@/components/page-header";

export default async function EditLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; lessonId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  await requireTutor();

  const { lessonId } = await params;
  const lesson = await getLesson(lessonId);
  if (!lesson) notFound();

  const [students, t, tForm, tCommon] = await Promise.all([
    listStudents(),
    getTranslations("timetable"),
    getTranslations("lessonForm"),
    getTranslations("common"),
  ]);

  const start = new Date(lesson.starts_at);
  const date = zonedDateKey(start);
  const { returnTo: returnParam } = await searchParams;
  const returnTo = safeReturnTo(returnParam, `/timetable?week=${startOfWeek(date)}`);

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <PageHeader title={t("editTitle")} backHref={returnTo} backLabel={tCommon("back")} />
      <Card>
        <CardContent>
          <LessonForm
            lessonId={lesson.id}
            students={students.map((s) => ({ id: s.id, full_name: s.full_name }))}
            returnTo={returnTo}
            cancelHref={returnTo}
            initial={{
              studentId: lesson.student_id,
              date,
              time: zonedTime(start),
              durationMin: String(lesson.duration_min),
              topic: lesson.topic ?? "",
              attended: lesson.attended === null ? "" : lesson.attended ? "true" : "false",
              tutorNote: lesson.tutor_note ?? "",
            }}
            extraActions={
              <DeleteButton
                action={deleteLesson.bind(null, lesson.id, returnTo)}
                label={tCommon("delete")}
                pendingLabel={tCommon("deleting")}
                confirmMessage={tForm("deleteConfirm")}
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
