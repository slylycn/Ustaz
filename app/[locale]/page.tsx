import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  redirect({ href: "/dashboard", locale });
}
