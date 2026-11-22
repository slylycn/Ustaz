import { getTranslations, setRequestLocale } from "next-intl/server";
import { resolveLocale } from "@/i18n/locale";
import { getUser, requireTutor } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { todayKey } from "@/lib/time";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { RubricForm } from "@/components/rubric-form";

export default async function NewRubricPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  const tutor = await requireTutor();
  const user = await getUser();

  const t = await getTranslations("rubrics");
  const tCommon = await getTranslations("common");
  const exam = tutor.exams[0] ?? "IELTS";
  const ielts = exam === "IELTS";

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader title={t("newTitle")} backHref="/rubrics" backLabel={tCommon("back")} />
      <Card>
        <CardContent>
          <RubricForm
            canCreatePlatform={isAdmin(user)}
            editingPlatform={false}
            today={todayKey()}
            cancelHref="/rubrics"
            initial={{
              exam,
              taskType: "",
              name: "",
              version: "v1",
              scaleMin: "0",
              scaleMax: ielts ? "9" : "10",
              scaleStep: ielts ? "0.5" : "1",
              overallRule: "",
              sourceUrl: "",
              lastVerified: "",
              criteria: [{ name: "", descriptors_by_score: {} }],
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
