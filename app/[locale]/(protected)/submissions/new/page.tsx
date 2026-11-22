import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookOpenCheck, UserPlus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { requireTutor } from "@/lib/auth";
import { listRubrics, listStudents } from "@/lib/data";
import { safeReturnTo } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { NewSubmissionForm } from "@/components/new-submission-form";
import { PageHeader } from "@/components/page-header";

export default async function NewSubmissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ student?: string; returnTo?: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  const tutor = await requireTutor();

  const { student, returnTo: returnParam } = await searchParams;
  const [students, rubrics, t, tCommon, tExams] = await Promise.all([
    listStudents(),
    listRubrics(),
    getTranslations("submission.new"),
    getTranslations("common"),
    getTranslations("exams"),
  ]);
  const backHref = safeReturnTo(returnParam, "/submissions");

  const chosenStudent = students.find((s) => s.id === student) ?? (students.length === 1 ? students[0] : undefined);
  // Suggest a rubric for the student's exam: their own first, then the platform one.
  const forExam = chosenStudent ? rubrics.filter((r) => r.exam === chosenStudent.exam_track) : [];
  const suggested = forExam.find((r) => r.owner === tutor.id) ?? forExam[0];

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} backHref={backHref} backLabel={tCommon("back")} />

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
      ) : rubrics.length === 0 ? (
        <EmptyState
          title={t("noRubricsTitle")}
          body={t("noRubricsBody")}
          action={
            <Button asChild>
              <Link href="/rubrics/new">
                <BookOpenCheck aria-hidden />
                {t("addRubric")}
              </Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent>
            <NewSubmissionForm
              tutorId={tutor.id}
              students={students.map((s) => ({ id: s.id, full_name: s.full_name }))}
              rubrics={rubrics.map((r) => ({ id: r.id, label: `${r.name} · ${tExams(r.exam)} · ${r.version}` }))}
              defaultStudentId={chosenStudent?.id ?? ""}
              defaultRubricId={suggested?.id ?? ""}
              cancelHref={backHref}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
