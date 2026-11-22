import "server-only";
import { cache } from "react";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tutor } from "@/lib/constants";

/** The signed-in Supabase user, or null. Verified with the Auth server (not just the cookie). */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** The signed-in tutor's profile row, or null if onboarding isn't done yet. */
export const getTutor = cache(async (): Promise<Tutor | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tutors")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data as Tutor | null;
});

/** Sends visitors who aren't signed in to /login. */
export async function requireUser() {
  const user = await getUser();
  if (!user) {
    const locale = await getLocale();
    return redirect({ href: "/login", locale });
  }
  return user;
}

/** Signed in AND onboarded; otherwise redirects to /login or /onboarding. */
export async function requireTutor() {
  await requireUser();
  const tutor = await getTutor();
  if (!tutor) {
    const locale = await getLocale();
    return redirect({ href: "/onboarding", locale });
  }
  return tutor;
}
