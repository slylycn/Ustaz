import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { getSharedReport } from "@/lib/supabase/public";
import { addDays, zonedToUtc } from "@/lib/time";
import { GradesChart } from "@/components/grades-chart";

// Always read fresh: a reset or un-approved link must stop working immediately.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

const NO_INDEX: Metadata["robots"] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: { index: false, follow: false, noimageindex: true },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const report = await getSharedReport(token);
  const t = await getTranslations({ locale: report?.language ?? "kk", namespace: "shared" });
  return {
    title: report ? t("metaTitle", { name: report.student_first_name }) : t("unavailableTitle"),
    robots: NO_INDEX,
    referrer: "no-referrer",
  };
}

/** Public, read-only, no login. Shows ONLY the approved message and that student's grades. */
export default async function SharedReportPage({ params }: Props) {
  const { token } = await params;
  const report = await getSharedReport(token);

  if (!report) {
    // We don't know the parent's language for an invalid link, so say it in both.
    const [kk, ru, common] = await Promise.all([
      getTranslations({ locale: "kk", namespace: "shared" }),
      getTranslations({ locale: "ru", namespace: "shared" }),
      getTranslations({ locale: "kk", namespace: "common" }),
    ]);
    return (
      <main className="mx-auto grid max-w-xl gap-4 px-4 py-16 text-center">
        <p className="text-lg font-semibold text-primary">{common("appName")}</p>
        <p lang="kk">{kk("unavailable")}</p>
        <p lang="ru">{ru("unavailable")}</p>
      </main>
    );
  }

  const locale = report.language;
  const t = await getTranslations({ locale, namespace: "shared" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const format = await getFormatter({ locale });
  const noon = (key: string) => zonedToUtc(key, "12:00");
  const weekLabel = format.dateTimeRange(noon(report.week_start), noon(addDays(report.week_start, 6)), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-4 py-10">
      <header className="grid gap-1">
        <p className="text-sm font-semibold text-primary">{tCommon("appName")}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title", { name: report.student_first_name })}</h1>
        <p className="text-sm text-muted-foreground">{weekLabel}</p>
      </header>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <p className="whitespace-pre-line leading-relaxed">{report.message}</p>
      </section>

      <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">{t("gradesTitle")}</h2>
        {report.grades.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noGrades")}</p>
        ) : (
          <GradesChart
            grades={report.grades}
            labels={{
              table: t("showTable"),
              date: t("date"),
              score: t("score"),
              formatDate: (date) => format.dateTime(noon(date), { day: "numeric", month: "short" }),
              describe: (rubric, count, first, last) => t("chartLabel", { rubric, count, first, last }),
            }}
          />
        )}
      </section>

      <footer className="text-center text-xs text-muted-foreground">{t("footer")}</footer>
    </main>
  );
}
