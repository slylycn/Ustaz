import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSession } from "./lib/supabase/proxy";

// Next.js 16 calls this "proxy" (it used to be "middleware").
const handleI18nRouting = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);
  return updateSession(request, response);
}

export const config = {
  // Everything except API routes, the auth callback, the one-click /demo, public share pages (/p/…),
  // Next internals and files with an extension.
  matcher: "/((?!api|auth|demo|p/|_next|_vercel|.*\\..*).*)",
};
