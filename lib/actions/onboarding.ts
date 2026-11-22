"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isExam, isOutputLanguage, type Exam } from "@/lib/constants";
import { isValidPhone } from "@/lib/validation";

export type OnboardingField = "fullName" | "phone" | "exams" | "outputLanguage";
export type OnboardingErrorKey =
  | "nameRequired"
  | "nameTooLong"
  | "phoneInvalid"
  | "examsRequired"
  | "languageInvalid"
  | "generic";

export type OnboardingState = {
  fieldErrors?: Partial<Record<OnboardingField, OnboardingErrorKey>>;
  formError?: OnboardingErrorKey;
};

export async function saveTutorProfile(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const locale = await getLocale();
  const user = await getUser();
  if (!user) return redirect({ href: "/login", locale });

  const fullName = String(formData.get("fullName") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const examsRaw = formData.getAll("exams").map(String);
  const outputLanguage = String(formData.get("outputLanguage") ?? "");

  const fieldErrors: OnboardingState["fieldErrors"] = {};

  if (!fullName) fieldErrors.fullName = "nameRequired";
  else if (fullName.length > 100) fieldErrors.fullName = "nameTooLong";

  if (phoneRaw && !isValidPhone(phoneRaw)) fieldErrors.phone = "phoneInvalid";

  const exams: Exam[] = [...new Set(examsRaw)].filter(isExam);
  if (exams.length === 0) fieldErrors.exams = "examsRequired";

  if (!isOutputLanguage(outputLanguage)) fieldErrors.outputLanguage = "languageInvalid";

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const supabase = await createClient();
  // RLS only allows a row whose id equals the signed-in user's id.
  const { error } = await supabase.from("tutors").upsert(
    {
      id: user.id,
      full_name: fullName,
      phone: phoneRaw || null,
      exams,
      output_language: outputLanguage,
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("saveTutorProfile failed", error);
    return { formError: "generic" };
  }

  return redirect({ href: "/dashboard", locale });
}
