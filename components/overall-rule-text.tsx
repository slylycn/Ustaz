import { useTranslations } from "next-intl";
import { parseOverallRule } from "@/lib/overall-rule";
import { scoreKey } from "@/lib/rubrics";

/** Explains how Ustaz will compute the overall score from a rubric's overall_rule text. */
export function OverallRuleText({ rule }: { rule: string }) {
  const t = useTranslations("overallRule");
  const parsed = parseOverallRule(rule);
  if (!parsed) return <>{t("notComputable")}</>;

  const kind = t(parsed.kind);
  if (parsed.rounding) {
    return <>{t("computed", { rule: `${kind}, ${t(parsed.rounding.mode, { step: scoreKey(parsed.rounding.step) })}` })}</>;
  }
  return <>{t("computed", { rule: parsed.kind === "mean" ? `${kind}, ${t("snap")}` : kind })}</>;
}
