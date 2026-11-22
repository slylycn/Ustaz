import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/** 404 inside the app, e.g. another tutor's student id or a deleted lesson. */
export default function NotFound() {
  const t = useTranslations("notFoundPage");
  return (
    <main className="mx-auto grid max-w-md gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("body")}</p>
      <Button asChild className="justify-self-center">
        <Link href="/dashboard">{t("home")}</Link>
      </Button>
    </main>
  );
}
