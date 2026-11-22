import { getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { LanguageSwitch } from "@/components/language-switch";
import { MainNav } from "@/components/main-nav";

export async function TopBar({ signedIn }: { signedIn: boolean }) {
  const t = await getTranslations("topBar");
  const tCommon = await getTranslations("common");

  return (
    <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 lg:h-14 lg:flex-nowrap lg:py-0">
        <Link href="/" className="text-lg font-semibold tracking-tight text-primary">
          {tCommon("appName")}
        </Link>

        {/* Below 1024px the nav gets its own scrollable row under the logo (7 items + long ru labels). */}
        {signedIn && <MainNav className="order-last -mx-1 w-full lg:order-none lg:mx-0 lg:w-auto lg:min-w-0 lg:flex-1" />}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <LanguageSwitch />
          {signedIn && (
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut aria-hidden />
                <span className="sr-only sm:not-sr-only">{t("logout")}</span>
              </Button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
