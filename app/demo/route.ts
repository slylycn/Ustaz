import { NextResponse, type NextRequest } from "next/server";
import { getPathname } from "@/i18n/navigation";
import { EXAMS } from "@/lib/constants";
import { seedDemoData } from "@/lib/demo-seed";
import { createClient } from "@/lib/supabase/server";

// Never cache or prerender: every visit may create a session.
export const dynamic = "force-dynamic";

/**
 * One-click demo for judges and visitors: /demo (Kazakh) or /demo?lang=ru (Russian).
 * Signs in as an anonymous Supabase user (no email), creates a demo tutor profile,
 * loads the demo data and lands on the dashboard. Requires
 * Supabase → Authentication → Sign In / Providers → "Allow anonymous sign-ins".
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const locale = searchParams.get("lang") === "ru" ? "ru" : "kk";
  const dashboard = `${origin}${getPathname({ href: "/dashboard", locale })}`;
  const fail = `${origin}${getPathname({ href: "/login", locale })}?error=demo`;

  const supabase = await createClient();
  const {
    data: { user: current },
  } = await supabase.auth.getUser();

  // A real tutor who is already signed in: leave their account alone.
  if (current && !current.is_anonymous) return NextResponse.redirect(dashboard);

  let userId = current?.id;
  if (!userId) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) {
      console.error("demo sign-in failed", error?.message);
      return NextResponse.redirect(fail);
    }
    userId = data.user.id;
  }

  // Skip onboarding: give the guest a ready-made tutor profile.
  const { error: tutorError } = await supabase.from("tutors").upsert(
    {
      id: userId,
      full_name: locale === "ru" ? "Демо-репетитор" : "Демо репетитор",
      exams: [...EXAMS],
      output_language: locale,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (tutorError) {
    console.error("demo tutor profile failed", tutorError.message);
    return NextResponse.redirect(fail);
  }

  // Students, lessons and essays; does nothing if this guest already has them.
  const seeded = await seedDemoData(supabase, userId, locale);
  if (seeded === "failed") return NextResponse.redirect(fail);

  return NextResponse.redirect(dashboard);
}
