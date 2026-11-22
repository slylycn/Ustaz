import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { requireTutor } from "@/lib/auth";
// Student-safe query: never selects teacher_key.
import { getHomeworkSheet } from "@/lib/data";
import { zonedToUtc } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/homework-actions";
import { HomeworkSheet } from "@/components/homework-sheet";

/** A4 student sheet. Print it, or "Save as PDF" in the browser's print dialog. */
export default async function HomeworkPrintPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  await requireTutor();

  const { id } = await params;
  const homework = await getHomeworkSheet(id);
  if (!homework) notFound();

  const t = await getTranslations("homework");
  const tExams = await getTranslations("exams");
  const format = await getFormatter();

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button asChild variant="ghost">
          <Link href={`/homework/${homework.id}`}>
            <ArrowLeft aria-hidden />
            {t("print.back")}
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{t("print.hint")}</span>
          <PrintButton />
        </div>
      </div>

      {/* The A4 page: on screen it looks like paper, in print it is the page. */}
      <article className="homework-print mx-auto w-full max-w-[210mm] rounded-sm bg-white p-[14mm] text-[11pt] leading-relaxed text-neutral-900 shadow-md print:max-w-none print:p-0 print:shadow-none">
        <header className="mb-6 grid gap-3 border-b border-neutral-300 pb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-[16pt] font-semibold">{homework.title}</h1>
            <span className="text-[10pt] text-neutral-600">
              {tExams(homework.exam)}
              {homework.level ? ` · ${homework.level}` : ""}
            </span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-x-8 gap-y-2 text-[10pt]">
            <span>
              {t("sheet.name")}:{" "}
              {homework.student?.full_name ? (
                <span className="font-medium">{homework.student.full_name}</span>
              ) : (
                <span className="inline-block w-56 border-b border-neutral-500 align-bottom" />
              )}
            </span>
            <span>
              {t("sheet.date")}: <span className="inline-block w-28 border-b border-neutral-500 align-bottom" />
            </span>
            {homework.due_date && (
              <span className="col-span-2 text-neutral-600">
                {t("due", { date: format.dateTime(zonedToUtc(homework.due_date, "12:00"), { day: "numeric", month: "long", year: "numeric" }) })}
              </span>
            )}
          </div>
        </header>

        <HomeworkSheet sheet={homework.student_sheet} variant="print" />
      </article>
    </div>
  );
}
