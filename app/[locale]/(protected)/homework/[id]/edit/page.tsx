import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { requireTutor } from "@/lib/auth";
import { getHomework, listStudents } from "@/lib/data";
import { joinItems } from "@/lib/homework";
import { HomeworkEditor } from "@/components/homework-editor";
import { PageHeader } from "@/components/page-header";

export default async function EditHomeworkPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  await requireTutor();

  const { id } = await params;
  const homework = await getHomework(id);
  if (!homework) notFound();
  // Assigned homework is read-only: "Back to draft" first.
  if (homework.status !== "draft") redirect({ href: `/homework/${homework.id}`, locale });

  const [students, t, tCommon] = await Promise.all([
    listStudents(),
    getTranslations("homework.editor"),
    getTranslations("common"),
  ]);
  const viewHref = `/homework/${homework.id}`;

  return (
    <div className="grid gap-6">
      <PageHeader title={t("title")} description={homework.title} backHref={viewHref} backLabel={tCommon("back")} />
      <HomeworkEditor
        homeworkId={homework.id}
        cancelHref={viewHref}
        students={students.map((s) => ({ id: s.id, full_name: s.full_name }))}
        initial={{
          title: homework.title,
          instructions: homework.student_sheet.instructions,
          items: joinItems(homework.student_sheet, homework.teacher_key),
          studentId: homework.student_id ?? "",
          dueDate: homework.due_date ?? "",
        }}
      />
    </div>
  );
}
