"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { getTutor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { seedDemoData } from "@/lib/demo-seed";

export type DemoResult = { ok: true } | { ok: false; error: "alreadyLoaded" | "generic" };

/** "Load demo data" button on the dashboard. */
export async function loadDemoData(): Promise<DemoResult> {
  const tutor = await getTutor();
  if (!tutor) return { ok: false, error: "generic" };
  const locale = await getLocale();
  const supabase = await createClient();

  const result = await seedDemoData(supabase, tutor.id, locale);
  if (result === "alreadyLoaded") return { ok: false, error: "alreadyLoaded" };
  if (result === "failed") return { ok: false, error: "generic" };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Deletes demo students; their lessons, submissions and reports are removed by cascade. */
export async function removeDemoData(): Promise<DemoResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("students").delete().eq("is_demo", true);
  if (error) {
    console.error("removeDemoData failed", error.message);
    return { ok: false, error: "generic" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
