import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { KeyRound, Pencil, Printer } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { requireTutor } from "@/lib/auth";
import { getHomework } from "@/lib/data";
import { deleteHomework } from "@/lib/actions/homework";
import { zonedToUtc } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteButton } from "@/components/delete-button";
import { AssignButton, RegenerateButton, UnassignButton } from "@/components/homework-actions";
import { HomeworkSheet, TeacherKeyView } from "@/components/homework-sheet";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { PageHeader } from "@/components/page-header";

// Regenerating with Aqylbek can take a while.
export const maxDuration = 300;

export default async function HomeworkPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  await requireTutor();

  const { id } = await params;
  const homework = await getHomework(id);
  if (!homework) notFound();

  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "key" ? "key" : "sheet";
  const t = await getTranslations("homework");
  const tCommon = await getTranslations("common");
  const tExams = await getTranslations("exams");
  const format = await getFormatter();
  const base = `/homework/${homework.id}`;
  const isDraft = homework.status === "draft";

  return (
    <div className="grid gap-6">
      <PageHeader
        title={homework.title}
        backHref="/homework"
        backLabel={t("list.title")}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <HomeworkStatusBadge status={homework.status} />
            <span>{tExams(homework.exam)}</span>
            {homework.level && <span>· {homework.level}</span>}
            <span>· {homework.student?.full_name ?? t("noStudent")}</span>
            {homework.due_date && (
              <span>
                · {t("due", { date: format.dateTime(zonedToUtc(homework.due_date, "12:00"), { day: "numeric", month: "long" }) })}
              </span>
            )}
          </span>
        }
        actions={
          <>
            <Button asChild variant="outline">
              {/* Opens the student-only A4 page; the teacher key is never loaded there. */}
              <Link href={`${base}/print`} target="_blank">
                <Printer aria-hidden />
                {t("actions.printPdf")}
              </Link>
            </Button>
            {isDraft ? (
              <>
                <Button asChild variant="outline">
                  <Link href={`${base}/edit`}>
                    <Pencil aria-hidden />
                    {tCommon("edit")}
                  </Link>
                </Button>
                <AssignButton homeworkId={homework.id} />
              </>
            ) : (
              <UnassignButton homeworkId={homework.id} />
            )}
          </>
        }
      />

      {!isDraft && <p className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">{t("assignedNote")}</p>}

      <nav aria-label={t("tabsLabel")} className="-mb-2 flex gap-1 overflow-x-auto border-b">
        {(["sheet", "key"] as const).map((key) => (
          <Link
            key={key}
            href={key === "sheet" ? base : { pathname: base, query: { tab: "key" } }}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {key === "key" && <KeyRound className="size-3.5" aria-hidden />}
            {key === "sheet" ? t("tabs.sheet") : t("tabs.key")}
          </Link>
        ))}
      </nav>

      <Card className="py-5">
        <CardContent>
          {tab === "sheet" ? (
            <HomeworkSheet sheet={homework.student_sheet} variant="screen" />
          ) : (
            <div className="grid gap-4">
              <p className="flex items-center gap-1.5 text-sm text-amber-900 dark:text-amber-200">
                <KeyRound className="size-4" aria-hidden />
                {t("key.onlyYou")}
              </p>
              <TeacherKeyView sheet={homework.student_sheet} teacherKey={homework.teacher_key} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-start justify-between gap-3">
        {isDraft && homework.topic ? <RegenerateButton homeworkId={homework.id} /> : <span />}
        <DeleteButton
          action={deleteHomework.bind(null, homework.id)}
          label={tCommon("delete")}
          pendingLabel={tCommon("deleting")}
          confirmMessage={t("deleteConfirm")}
        />
      </div>
    </div>
  );
}
