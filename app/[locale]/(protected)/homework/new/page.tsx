import { getTranslations, setRequestLocale } from "next-intl/server";
import { resolveLocale } from "@/i18n/locale";
import { requireTutor } from "@/lib/auth";
import { listStudents } from "@/lib/data";
import { safeReturnTo } from "@/lib/validation";
import { Card, CardContent } from "@/components/ui/card";
import { HomeworkForm } from "@/components/homework-form";
import { PageHeader } from "@/components/page-header";

// Generating with Aqylbek can take a while; allow the server action up to 5 minutes on Vercel.
export const maxDuration = 300;

export default async function NewHomeworkPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ student?: string; returnTo?: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  const tutor = await requireTutor();

  const { student, returnTo } = await searchParams;
  const [students, t, tCommon] = await Promise.all([
    listStudents(),
    getTranslations("homework.new"),
    getTranslations("common"),
  ]);
  const chosen = students.find((s) => s.id === student);
  const backHref = safeReturnTo(returnTo, "/homework");

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} backHref={backHref} backLabel={tCommon("back")} />
      <Card>
        <CardContent>
          <HomeworkForm
            tutorId={tutor.id}
            defaultExam={chosen?.exam_track ?? tutor.exams[0] ?? "IELTS"}
            students={students.map((s) => ({ id: s.id, full_name: s.full_name }))}
            defaultStudentId={chosen?.id ?? ""}
            cancelHref={backHref}
          />
        </CardContent>
      </Card>
    </div>
  );
}
