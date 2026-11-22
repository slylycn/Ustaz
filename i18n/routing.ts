import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["kk", "ru"],
  defaultLocale: "kk",
  // Kazakh URLs have no prefix (/login, /dashboard); Russian ones do (/ru/login).
  localePrefix: "as-needed",
});
