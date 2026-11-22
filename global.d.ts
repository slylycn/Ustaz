import { routing } from "@/i18n/routing";
import messages from "./messages/kk.json";

// Makes useTranslations()/getTranslations() type-check keys against kk.json.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
