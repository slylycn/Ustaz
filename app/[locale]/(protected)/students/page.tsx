import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronRight, Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { requireTutor } from "@/lib/auth";
import { listStudents } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default async function StudentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  await requireTutor();

  const students = await listStudents();
  const t = await getTranslations("students");
  const tExams = await getTranslations("exams");
  const none = (await getTranslations("common"))("none");

  const addButton = (
    <Button asChild>
      <Link href="/students/new">
        <Plus aria-hidden />
        {t("add")}
      </Link>
    </Button>
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t("title")}
        description={students.length > 0 ? t("count", { count: students.length }) : undefined}
        actions={students.length > 0 ? addButton : undefined}
      />

      {students.length === 0 ? (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")} action={addButton} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1.5fr_auto] gap-4 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
            <span>{t("columns.name")}</span>
            <span>{t("columns.exam")}</span>
            <span>{t("columns.grade")}</span>
            <span>{t("columns.target")}</span>
            <span>{t("columns.parent")}</span>
            <span className="w-4" />
          </div>
          <ul className="divide-y">
            {students.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/students/${s.id}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-accent md:grid-cols-[2fr_1fr_1fr_1fr_1.5fr_auto]"
                >
                  <span className="font-medium">{s.full_name}</span>
                  <ChevronRight className="size-4 text-muted-foreground md:order-last" aria-hidden />
                  <span className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground md:contents">
                    <span>
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {tExams(s.exam_track)}
                      </span>
                    </span>
                    <span>{s.grade_or_age ?? none}</span>
                    <span>{s.target_score ?? none}</span>
                    <span className="truncate">
                      {[s.parent_name, s.parent_phone].filter(Boolean).join(" · ") || none}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
