import { setRequestLocale } from "next-intl/server";
import { getPathname, redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { getUser } from "@/lib/auth";
import { TopBar } from "@/components/top-bar";
import { LoginForm } from "@/components/login-form";

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

  return (
    <>
      <TopBar signedIn={false} />
      <main className="mx-auto flex max-w-md flex-col px-4 py-16">
        <LoginForm
          next={getPathname({ href: "/dashboard", locale })}
          googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true"}
          authFailed={error === "auth"}
        />
      </main>
    </>
  );
}
