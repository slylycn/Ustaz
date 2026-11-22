import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { isUuid } from "@/lib/validation";

/** What /p/<token> may show. Shape is fixed by the SQL function get_shared_report(). */
export type SharedReport = {
  message: string;
  week_start: string;
  language: "kk" | "ru";
  student_first_name: string;
  grades: { date: string; rubric: string; overall: number; scale_min: number | null; scale_max: number | null }[];
};

/**
 * Reads a shared report WITHOUT any login: a plain anon client (no cookies, no session)
 * calling the security-definer function, which returns only approved, minimal data.
 */
export const getSharedReport = cache(async (token: string): Promise<SharedReport | null> => {
  if (!isUuid(token)) return null;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.rpc("get_shared_report", { token });
  if (error) {
    console.error("get_shared_report failed", error.code);
    return null;
  }
  if (!data) return null;
  const report = data as SharedReport;
  return {
    ...report,
    grades: (report.grades ?? []).map((g) => ({
      ...g,
      overall: Number(g.overall),
      scale_min: g.scale_min === null ? null : Number(g.scale_min),
      scale_max: g.scale_max === null ? null : Number(g.scale_max),
    })),
  };
});
