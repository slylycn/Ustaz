import { getTranslations, setRequestLocale } from "next-intl/server";
import { UserPlus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { requireTutor } from "@/lib/auth";
import { listStudents } from "@/lib/data";
import { isDateKey, todayKey } from "@/lib/time";
import { safeReturnTo } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { LessonForm } from "@/components/lesson-form";
import { PageHeader } from "@/components/page-header";

export default async function NewLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; student?: string; returnTo?: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  await requireTutor();

  const { date, student, returnTo: returnParam } = await searchParams;
  const students = await listStudents();
  const t = await getTranslations("timetable");
  const tCommon = await getTranslations("common");
  const returnTo = safeReturnTo(returnParam, "/timetable");

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <PageHeader title={t("newTitle")} backHref={returnTo} backLabel={tCommon("back")} />

      {students.length === 0 ? (
        <EmptyState
          title={t("noStudentsTitle")}
          body={t("noStudentsBody")}
          action={
            <Button asChild>
              <Link href="/students/new">
                <UserPlus aria-hidden />
                {t("addStudent")}
              </Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent>
            <LessonForm
              students={students.map((s) => ({ id: s.id, full_name: s.full_name }))}
              returnTo={returnTo}
              cancelHref={returnTo}
              initial={{
                studentId: students.some((s) => s.id === student) ? student! : students.length === 1 ? students[0].id : "",
                date: isDateKey(date) ? date : todayKey(),
                time: "15:00",
                durationMin: "60",
                topic: "",
                attended: "",
                tutorNote: "",
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
