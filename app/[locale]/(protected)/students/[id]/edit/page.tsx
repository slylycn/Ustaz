import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { resolveLocale } from "@/i18n/locale";
import { requireTutor } from "@/lib/auth";
import { getStudent } from "@/lib/data";
import { deleteStudent } from "@/lib/actions/students";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StudentForm } from "@/components/student-form";
import { DeleteButton } from "@/components/delete-button";

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  await requireTutor();

  const { id } = await params;
  const student = await getStudent(id);
  if (!student) notFound();

  const t = await getTranslations("students");
  const tForm = await getTranslations("studentForm");
  const tCommon = await getTranslations("common");
  const profileHref = `/students/${student.id}`;

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <PageHeader
        title={t("editTitle")}
        description={student.full_name}
        backHref={profileHref}
        backLabel={tCommon("back")}
      />
      <Card>
        <CardContent>
          <StudentForm
            studentId={student.id}
            cancelHref={profileHref}
            initial={{
              fullName: student.full_name,
              gradeOrAge: student.grade_or_age ?? "",
              examTrack: student.exam_track,
              targetScore: student.target_score ?? "",
              parentName: student.parent_name ?? "",
              parentPhone: student.parent_phone ?? "",
              parentLanguage: student.parent_language,
              notes: student.notes ?? "",
            }}
            extraActions={
              <DeleteButton
                action={deleteStudent.bind(null, student.id)}
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
