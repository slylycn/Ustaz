import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getPathname } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic links and Google sign-in both land here.
 * - ?code=...                 → PKCE flow (default email template, Google OAuth)
 * - ?token_hash=...&type=...  → custom email template flow (optional)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  const supabase = await createClient();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  }

  if (ok) return NextResponse.redirect(`${origin}${next}`);

  const locale = next === "/ru" || next.startsWith("/ru/") ? "ru" : "kk";
  const loginPath = getPathname({ href: "/login", locale });
  return NextResponse.redirect(`${origin}${loginPath}?error=auth`);
}

/** Only allow same-site relative paths, so the link can't bounce users to another site. */
function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}
