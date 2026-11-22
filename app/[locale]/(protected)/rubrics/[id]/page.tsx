import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExternalLink, Pencil } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { getUser, requireTutor } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getRubric } from "@/lib/data";
import { deleteRubric } from "@/lib/actions/rubrics";
import { countFilledDescriptors, scoreKey, sortScoresDesc } from "@/lib/rubrics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteButton } from "@/components/delete-button";
import { DuplicateRubricButton } from "@/components/duplicate-rubric-button";
import { PageHeader } from "@/components/page-header";
import { VerifiedBadge } from "@/components/verified-badge";
import { OverallRuleText } from "@/components/overall-rule-text";

export default async function RubricPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  const tutor = await requireTutor();
  const user = await getUser();

  const { id } = await params;
  const rubric = await getRubric(id);
  if (!rubric) notFound();

  const isPlatform = rubric.owner === null;
  const canEdit = isPlatform ? isAdmin(user) : rubric.owner === tutor.id;
  const filled = countFilledDescriptors(rubric.criteria);

  const t = await getTranslations("rubrics");
  const tCommon = await getTranslations("common");
  const tExams = await getTranslations("exams");

  const details = [
    { label: t("exam"), value: tExams(rubric.exam) },
    { label: t("taskType"), value: rubric.task_type },
    { label: t("version"), value: rubric.version },
    {
      label: t("scale"),
      value: t("scaleValue", {
        min: scoreKey(rubric.scale_min),
        max: scoreKey(rubric.scale_max),
        step: scoreKey(rubric.scale_step),
      }),
    },
  ];

  return (
    <div className="grid gap-6">
      <PageHeader
        title={rubric.name}
        backHref="/rubrics"
        backLabel={t("title")}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
              {isPlatform ? t("platformBadge") : t("mineBadge")}
            </span>
            <VerifiedBadge lastVerified={rubric.last_verified} showStaleHint />
          </span>
        }
        actions={
          <>
            <DuplicateRubricButton rubricId={rubric.id} />
            {canEdit && (
              <Button asChild>
                <Link href={`/rubrics/${rubric.id}/edit`}>
                  <Pencil aria-hidden />
                  {tCommon("edit")}
                </Link>
              </Button>
            )}
          </>
        }
      />

      {isPlatform && !canEdit && (
        <p className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">{t("readOnlyNote")}</p>
      )}

      <Card className="py-4">
        <CardContent className="grid gap-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            {details.map((d) => (
              <div key={d.label} className="grid gap-0.5">
                <dt className="text-muted-foreground">{d.label}</dt>
                <dd className="font-medium">{d.value}</dd>
              </div>
            ))}
          </dl>
          <div className="grid gap-0.5 border-t pt-3 text-sm">
            <span className="text-muted-foreground">{t("overallRule")}</span>
            <p className="whitespace-pre-line">{rubric.overall_rule}</p>
            <p className="text-xs text-muted-foreground">
              <OverallRuleText rule={rubric.overall_rule} />
            </p>
          </div>
          <div className="grid gap-0.5 text-sm">
            <span className="text-muted-foreground">{t("source")}</span>
            {rubric.source_url ? (
              <a
                href={rubric.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1 break-all text-primary hover:underline"
              >
                {rubric.source_url}
                <ExternalLink className="size-3.5 shrink-0" aria-hidden />
              </a>
            ) : (
              <span>{tCommon("none")}</span>
            )}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">{t("criteria")}</h2>
          <span className="text-sm text-muted-foreground">{t("criteriaCount", { count: rubric.criteria.length })}</span>
        </div>

        {filled === 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-4 text-sm">
            <span className="text-muted-foreground">{t("descriptorsEmpty")}</span>
            {canEdit && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/rubrics/${rubric.id}/edit`}>{t("fillDescriptors")}</Link>
              </Button>
            )}
          </div>
        )}

        {rubric.criteria.map((criterion, index) => {
          const scores = sortScoresDesc(Object.keys(criterion.descriptors_by_score));
          return (
            <Card key={`${index}-${criterion.name}`} className="gap-3 py-4">
              <CardHeader>
                <CardTitle>{criterion.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {scores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noScoreRows")}</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sr-only">
                      <tr>
                        <th scope="col">{t("score")}</th>
                        <th scope="col">{t("descriptor")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {scores.map((score) => {
                        const text = criterion.descriptors_by_score[score];
                        return (
                          <tr key={score} className="align-top">
                            <th scope="row" className="w-16 py-2 pr-3 text-left font-semibold tabular-nums">
                              {score}
                            </th>
                            <td className="py-2 whitespace-pre-line">
                              {text ? text : <span className="text-muted-foreground italic">{t("descriptorEmptyCell")}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>

      {canEdit && (
        <div className="flex justify-end">
          <DeleteButton
            action={deleteRubric.bind(null, rubric.id)}
            label={tCommon("delete")}
            pendingLabel={tCommon("deleting")}
            confirmMessage={t("deleteConfirm")}
          />
        </div>
      )}
    </div>
  );
}
