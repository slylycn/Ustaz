import { getTranslations, setRequestLocale } from "next-intl/server";
import { PlayCircle } from "lucide-react";
import { getPathname, redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { getUser } from "@/lib/auth";
import { TopBar } from "@/components/top-bar";
import { LoginForm } from "@/components/login-form";
import { Button } from "@/components/ui/button";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);

  const user = await getUser();
  if (user) redirect({ href: "/dashboard", locale });

  const { error } = await searchParams;
  const t = await getTranslations("login");

  return (
    <>
      <TopBar signedIn={false} />
      <main className="mx-auto flex max-w-md flex-col px-4 py-16">
        <LoginForm
          next={getPathname({ href: "/dashboard", locale })}
          googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true"}
          authFailed={error === "auth"}
        />

        {/* One-click demo: no email needed (for judges and first-time visitors). */}
        <div className="mt-6 grid gap-2 text-center">
          <Button asChild variant="secondary" size="lg">
            <a href={locale === "ru" ? "/demo?lang=ru" : "/demo"}>
              <PlayCircle aria-hidden />
              {t("demo")}
            </a>
          </Button>
          <p className="text-sm text-muted-foreground">{t("demoHint")}</p>
          {error === "demo" && (
            <p role="alert" className="text-sm text-destructive">
              {t("demoFailed")}
            </p>
          )}
        </div>
      </main>
    </>
  );
}
