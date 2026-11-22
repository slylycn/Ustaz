import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronRight, Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { requireTutor } from "@/lib/auth";
import { listRubrics } from "@/lib/data";
import type { Rubric } from "@/lib/constants";
import { scoreKey } from "@/lib/rubrics";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { VerifiedBadge } from "@/components/verified-badge";

export default async function RubricsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  const tutor = await requireTutor();

  const rubrics = await listRubrics();
  const platform = rubrics.filter((r) => r.owner === null);
  const mine = rubrics.filter((r) => r.owner === tutor.id);
  const t = await getTranslations("rubrics");

  return (
    <div className="grid gap-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild>
            <Link href="/rubrics/new">
              <Plus aria-hidden />
              {t("add")}
            </Link>
          </Button>
        }
      />

      <RubricSection title={t("platformSection")} hint={t("platformHint")} rubrics={platform} emptyText={t("platformEmpty")} />
      <RubricSection title={t("mineSection")} rubrics={mine} emptyText={t("mineEmpty")} />
    </div>
  );
}

async function RubricSection({
  title,
  hint,
  rubrics,
  emptyText,
}: {
  title: string;
  hint?: string;
  rubrics: Rubric[];
  emptyText: string;
}) {
  const t = await getTranslations("rubrics");
  const tExams = await getTranslations("exams");

  return (
    <section className="grid gap-3">
      <div className="grid gap-0.5">
        <h2 className="font-semibold">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>

      {rubrics.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {rubrics.map((r) => (
            <li key={r.id}>
              <Link
                href={`/rubrics/${r.id}`}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent"
              >
                <div className="grid min-w-0 flex-1 gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.name}</span>
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {tExams(r.exam)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span>{r.task_type}</span>
                    <span>{t("versionValue", { version: r.version })}</span>
                    <span>
                      {t("scaleValue", {
                        min: scoreKey(r.scale_min),
                        max: scoreKey(r.scale_max),
                        step: scoreKey(r.scale_step),
                      })}
                    </span>
                    <span>{t("criteriaCount", { count: r.criteria.length })}</span>
                  </div>
                  <VerifiedBadge lastVerified={r.last_verified} />
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
