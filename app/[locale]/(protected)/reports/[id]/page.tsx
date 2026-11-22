import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { AlertCircle, ExternalLink } from "lucide-react";
import { resolveLocale } from "@/i18n/locale";
import { requireTutor } from "@/lib/auth";
import { getReport } from "@/lib/data";
import { deleteReport } from "@/lib/actions/reports";
import type { ReportInput } from "@/lib/report-input";
import { addDays, zonedToUtc } from "@/lib/time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteButton } from "@/components/delete-button";
import { PageHeader } from "@/components/page-header";
import { DraftReportsButton, ShareActions } from "@/components/report-buttons";
import { ReportEditor } from "@/components/report-editor";
import { ReportStatusBadge } from "@/components/report-status-badge";

export const maxDuration = 300;

/** Origin for share links: the host the tutor is using (works on Vercel and custom domains). */
async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  await requireTutor();

  const { id } = await params;
  const report = await getReport(id);
  if (!report || !report.student) notFound();

  const t = await getTranslations("reports");
  const tCommon = await getTranslations("common");
  const tLang = await getTranslations("outputLanguages");
  const format = await getFormatter();
  const parentLanguage = report.student.parent_language;
  // WhatsApp text is in the PARENT's language, whatever language the tutor uses the app in.
  const tParent = await getTranslations({ locale: parentLanguage, namespace: "reports.whatsapp" });

  const noon = (key: string) => zonedToUtc(key, "12:00");
  const weekLabel = format.dateTimeRange(noon(report.week_start), noon(addDays(report.week_start, 6)), {
    day: "numeric",
    month: "long",
  });
  const needsData = report.status === "draft" && report.ai_status === "needs_data";
  const shareUrl = report.share_token ? `${await siteOrigin()}/p/${report.share_token}` : null;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={report.student.full_name}
        backHref={`/reports?week=${report.week_start}`}
        backLabel={t("title")}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <ReportStatusBadge status={needsData ? "needs_data" : report.status} />
            <span>{weekLabel}</span>
            <span>· {t("parentLine", { parent: report.student.parent_name ?? t("parentUnknown"), language: tLang(parentLanguage) })}</span>
          </span>
        }
      />

      {needsData && (
        <Card className="gap-3 border-amber-300/70 bg-amber-50/60 py-4 dark:border-amber-500/30 dark:bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="size-4 text-amber-700 dark:text-amber-300" aria-hidden />
              {t("needsData.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {report.missing.length > 0 ? (
              <ul className="grid list-disc gap-1 pl-5">
                {report.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : (
              <p>{t("needsData.emptyWeek")}</p>
            )}
            <p className="text-muted-foreground">{t("needsData.hint")}</p>
            <DraftReportsButton week={report.week_start} studentIds={[report.student_id]} label={t("redraft")} variant="outline" />
          </CardContent>
        </Card>
      )}

      {report.status === "draft" && !needsData && (
        <Card className="py-4">
          <CardContent className="grid gap-4">
            <ReportEditor reportId={report.id} initialMessage={report.message ?? ""} />
            <div className="border-t pt-3">
              <DraftReportsButton
                week={report.week_start}
                studentIds={[report.student_id]}
                label={t("redraft")}
                variant="outline"
                confirmMessage={t("redraftConfirm")}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {report.status !== "draft" && report.message && shareUrl && (
        <Card className="gap-4 py-4">
          <CardHeader>
            <CardTitle>{t("approvedTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="rounded-lg border bg-background p-3 text-sm whitespace-pre-line">{report.message}</p>
            <div className="grid gap-1 text-sm">
              <span className="text-muted-foreground">{t("share.linkLabel")}</span>
              <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 break-all text-primary hover:underline">
                {shareUrl}
                <ExternalLink className="size-3.5 shrink-0" aria-hidden />
              </a>
              <span className="text-xs text-muted-foreground">{t("share.linkHint")}</span>
            </div>
            <ShareActions
              reportId={report.id}
              shareUrl={shareUrl}
              whatsappText={`${report.message}\n\n${tParent("linkLine")}\n${shareUrl}`}
              parentPhone={report.student.parent_phone}
            />
          </CardContent>
        </Card>
      )}

      <DataUsed input={report.input_data} />

      <div className="flex justify-end">
        <DeleteButton
          action={deleteReport.bind(null, report.id)}
          label={tCommon("delete")}
          pendingLabel={tCommon("deleting")}
          confirmMessage={t("deleteConfirm")}
        />
      </div>
    </div>
  );
}

/** What the draft was based on: the facts collected in code for this week. */
async function DataUsed({ input }: { input: ReportInput }) {
  const t = await getTranslations("reports.data");
  return (
    <details className="rounded-xl border bg-card">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{t("title")}</summary>
      <dl className="grid gap-3 border-t px-4 py-3 text-sm sm:grid-cols-2">
        <div className="grid gap-0.5">
          <dt className="text-muted-foreground">{t("lessons")}</dt>
          <dd>
            {t("lessonsValue", {
              total: input.lessons.total,
              attended: input.lessons.attended,
              missed: input.lessons.missed,
              notMarked: input.lessons.not_marked,
            })}
          </dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-muted-foreground">{t("homework")}</dt>
          <dd>{input.homework.assigned.length ? input.homework.assigned.map((h) => h.title).join(", ") : t("none")}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-muted-foreground">{t("work")}</dt>
          <dd>{t("workValue", { count: input.work_submitted.length })}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-muted-foreground">{t("grades")}</dt>
          <dd>
            {input.grades.this_week.length
              ? input.grades.this_week.map((g) => `${g.rubric ?? ""} ${g.overall ?? ""}`.trim()).join(", ")
              : t("none")}
          </dd>
        </div>
        <div className="grid gap-0.5 sm:col-span-2">
          <dt className="text-muted-foreground">{t("notes")}</dt>
          <dd className="whitespace-pre-line">
            {input.lessons.items.filter((l) => l.tutor_note).map((l) => `${l.date}: ${l.tutor_note}`).join("\n") || t("none")}
          </dd>
        </div>
      </dl>
    </details>
  );
}
