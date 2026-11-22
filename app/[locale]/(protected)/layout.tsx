import { setRequestLocale } from "next-intl/server";
import { resolveLocale } from "@/i18n/locale";
import { requireUser } from "@/lib/auth";
import { TopBar } from "@/components/top-bar";

// Everything inside (protected) requires a signed-in tutor.
export default async function ProtectedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  await requireUser();

  return (
    <>
      <TopBar signedIn />
      <main className="mx-auto max-w-5xl px-4 py-8 print:max-w-none print:p-0">{children}</main>
    </>
  );
}
