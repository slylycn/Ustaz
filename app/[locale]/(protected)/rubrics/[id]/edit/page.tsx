import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { getUser, requireTutor } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getRubric } from "@/lib/data";
import { deleteRubric } from "@/lib/actions/rubrics";
import { scoreKey } from "@/lib/rubrics";
import { todayKey } from "@/lib/time";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteButton } from "@/components/delete-button";
import { PageHeader } from "@/components/page-header";
import { RubricForm } from "@/components/rubric-form";

export default async function EditRubricPage({
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
  // Read-only for this tutor: send them back to the view page (it offers "Make a copy").
  if (!canEdit) redirect({ href: `/rubrics/${rubric.id}`, locale });

  const t = await getTranslations("rubrics");
  const tCommon = await getTranslations("common");
  const viewHref = `/rubrics/${rubric.id}`;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader
        title={t("editTitle")}
        description={rubric.name}
        backHref={viewHref}
        backLabel={tCommon("back")}
      />
      <Card>
        <CardContent>
          <RubricForm
            rubricId={rubric.id}
            canCreatePlatform={false}
            editingPlatform={isPlatform}
            today={todayKey()}
            cancelHref={viewHref}
            initial={{
              exam: rubric.exam,
              taskType: rubric.task_type,
              name: rubric.name,
              version: rubric.version,
              scaleMin: scoreKey(rubric.scale_min),
              scaleMax: scoreKey(rubric.scale_max),
              scaleStep: scoreKey(rubric.scale_step),
              overallRule: rubric.overall_rule,
              sourceUrl: rubric.source_url ?? "",
              lastVerified: rubric.last_verified ?? "",
              criteria: rubric.criteria,
            }}
            extraActions={
              <DeleteButton
                action={deleteRubric.bind(null, rubric.id)}
                label={tCommon("delete")}
                pendingLabel={tCommon("deleting")}
                confirmMessage={t("deleteConfirm")}
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
