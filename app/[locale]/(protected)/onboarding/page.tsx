import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { getTutor, requireUser } from "@/lib/auth";
import { OnboardingForm } from "@/components/onboarding-form";

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);

  const user = await requireUser();
  const tutor = await getTutor();
  if (tutor) redirect({ href: "/dashboard", locale });

  // Google sign-in gives us a name; magic link users start empty.
  const meta = user.user_metadata ?? {};
  const suggestedName = String(meta.full_name ?? meta.name ?? "");

  return (
    <div className="mx-auto max-w-xl">
      <OnboardingForm defaultName={suggestedName} defaultLanguage={locale} />
    </div>
  );
}
