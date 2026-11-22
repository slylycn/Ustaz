import { getTranslations, setRequestLocale } from "next-intl/server";
import { resolveLocale } from "@/i18n/locale";
import { requireTutor } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StudentForm } from "@/components/student-form";

export default async function NewStudentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  const tutor = await requireTutor();

  const t = await getTranslations("students");
  const tCommon = await getTranslations("common");

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <PageHeader title={t("newTitle")} backHref="/students" backLabel={tCommon("back")} />
      <Card>
        <CardContent>
          <StudentForm
            cancelHref="/students"
            initial={{
              fullName: "",
              gradeOrAge: "",
              // Start with the tutor's first exam; most tutors focus on one.
              examTrack: tutor.exams[0] ?? "IELTS",
              targetScore: "",
              parentName: "",
              parentPhone: "",
              parentLanguage: tutor.output_language,
              notes: "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
