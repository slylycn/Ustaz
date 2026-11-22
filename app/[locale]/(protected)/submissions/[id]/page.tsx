import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ExternalLink, FileText } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { requireTutor } from "@/lib/auth";
import { getSubmission } from "@/lib/data";
import { deleteSubmission } from "@/lib/actions/submissions";
import { createClient } from "@/lib/supabase/server";
import { DOCX_MIME } from "@/lib/constants";
import type { GradeResult } from "@/lib/grading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteButton } from "@/components/delete-button";
import { GradeButton } from "@/components/grade-button";
import { GradeReview } from "@/components/grade-review";
import { OverallRuleText } from "@/components/overall-rule-text";
import { PageHeader } from "@/components/page-header";
import { ReopenButton } from "@/components/reopen-button";
import { SubmissionStatusBadge } from "@/components/submission-status-badge";

// Grading with Aqylbek can take a while; allow the server action up to 5 minutes on Vercel.
export const maxDuration = 300;

export default async function SubmissionPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  await requireTutor();

  const { id } = await params;
  const submission = await getSubmission(id);
  if (!submission) notFound();

  const t = await getTranslations("submission");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();

  // Short-lived link to the private file (10 minutes).
  let fileUrl: string | null = null;
  if (submission.file_path) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("submissions").createSignedUrl(submission.file_path, 600);
    fileUrl = data?.signedUrl ?? null;
  }

  const snapshot = submission.rubric_snapshot;
  const rubricName = submission.rubric?.name ?? snapshot?.name ?? t("noRubric");

  return (
    <div className="grid gap-6">
      <PageHeader
        title={submission.student?.full_name ?? t("unknownStudent")}
        backHref="/submissions"
        backLabel={t("list.title")}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <SubmissionStatusBadge status={submission.status} />
            <span>{rubricName}</span>
            <span>· {format.dateTime(new Date(submission.created_at), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span>
          </span>
        }
      />

      {/* The task and the student's work */}
      <Card className="gap-4 py-4">
        <CardHeader>
          <CardTitle>{t("detail.task")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="whitespace-pre-line text-sm">{submission.task_prompt}</p>

          {submission.file_path && (
            <div className="grid gap-2">
              {fileUrl && submission.file_mime?.startsWith("image/") && (
                <img src={fileUrl} alt={t("detail.imageAlt")} className="max-h-[32rem] w-auto rounded-lg border object-contain" />
              )}
              {fileUrl ? (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <FileText className="size-4" aria-hidden />
                  {submission.file_mime === DOCX_MIME ? t("detail.downloadDocx") : t("detail.openFile")}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : (
                <p className="text-sm text-destructive">{t("detail.fileUnavailable")}</p>
              )}
            </div>
          )}

          {submission.text_content && (
            <details open={!submission.file_path} className="rounded-lg border bg-muted/30">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                {submission.file_mime === DOCX_MIME ? t("detail.extractedText") : t("detail.studentText")}
              </summary>
              <div className="max-h-[28rem] overflow-y-auto border-t px-3 py-2 text-sm whitespace-pre-wrap">
                {submission.text_content}
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      {/* Grading */}
      {submission.status === "draft" && (
        <Card className="gap-3 py-4">
          <CardHeader>
            <CardTitle>{t("grade.title")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm text-muted-foreground">{t("grade.body")}</p>
            <GradeButton submissionId={submission.id} />
          </CardContent>
        </Card>
      )}

      {submission.status === "ai_done" && snapshot && submission.final_result && (
        <section className="grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid gap-1">
              <h2 className="text-lg font-semibold">{t("review.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("review.subtitle")}</p>
            </div>
            <GradeButton submissionId={submission.id} regrade />
          </div>
          <GradeReview
            submissionId={submission.id}
            snapshot={snapshot}
            initial={submission.final_result}
            ruleText={<OverallRuleText rule={snapshot.overall_rule} />}
          />
        </section>
      )}

      {submission.status === "approved" && submission.final_result && (
        <ApprovedResult
          result={submission.final_result}
          approvedAt={submission.approved_at}
          rule={snapshot?.overall_rule ?? ""}
          studentId={submission.student_id}
          actions={<ReopenButton submissionId={submission.id} />}
        />
      )}

      <div className="flex justify-end">
        <DeleteButton
          action={deleteSubmission.bind(null, submission.id)}
          label={tCommon("delete")}
          pendingLabel={tCommon("deleting")}
          confirmMessage={t("detail.deleteConfirm")}
        />
      </div>
    </div>
  );
}

async function ApprovedResult({
  result,
  approvedAt,
  rule,
  studentId,
  actions,
}: {
  result: GradeResult;
  approvedAt: string | null;
  rule: string;
  studentId: string;
  actions: React.ReactNode;
}) {
  const t = await getTranslations("submission");
  const format = await getFormatter();

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">{t("approved.title")}</h2>
          {approvedAt && (
            <p className="text-sm text-muted-foreground">
              {t("approved.at", { date: format.dateTime(new Date(approvedAt), { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) })}
            </p>
          )}
        </div>
        {actions}
      </div>

      <div className="flex flex-wrap items-baseline gap-3 rounded-xl border bg-card p-4">
        <span className="font-medium">{t("review.overall")}</span>
        <span className="text-3xl font-semibold tabular-nums">{result.overall}</span>
        {rule && (
          <span className="text-sm text-muted-foreground">
            {result.overall_source === "computed" ? <OverallRuleText rule={rule} /> : t("approved.tutorOverall")}
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">{t("review.criterion")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("review.score")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("review.evidence")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("review.comment")}</th>
            </tr>
          </thead>
          <tbody className="divide-y align-top">
            {result.criteria.map((c) => (
              <tr key={c.name}>
                <th scope="row" className="px-4 py-3 text-left font-medium">{c.name}</th>
                <td className="px-4 py-3 text-base font-semibold tabular-nums">{c.score}</td>
                <td className="px-4 py-3">
                  {c.evidence.length > 0 ? (
                    <ul className="grid gap-1">
                      {c.evidence.map((q, i) => (
                        <li key={i} className="border-l-2 pl-2 text-muted-foreground italic">
                          {q}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </td>
                <td className="px-4 py-3 whitespace-pre-line">{c.comment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.student_feedback && (
        <Card className="gap-2 py-4">
          <CardHeader>
            <CardTitle>{t("review.studentFeedback")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm">{result.student_feedback}</p>
          </CardContent>
        </Card>
      )}

      {result.flags.length > 0 && (
        <div className="grid gap-2">
          <span className="text-sm font-medium">{t("review.flags")}</span>
          <ul className="flex flex-wrap gap-2">
            {result.flags.map((f, i) => (
              <li key={i} className="rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        <Link href={{ pathname: `/students/${studentId}`, query: { tab: "grades" } }} className="hover:underline">
          {t("approved.visibleNote")}
        </Link>
      </p>
    </section>
  );
}
