import { hasLocale, type Locale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "./routing";

/** Reads the [locale] route param and 404s on anything that isn't kk or ru. */
export async function resolveLocale(
  params: Promise<{ locale: string }>,
): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return locale;
}
