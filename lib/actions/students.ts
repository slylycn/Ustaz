"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LIMITS, isExam, isOutputLanguage } from "@/lib/constants";
import { formText, isUuid, isValidPhone } from "@/lib/validation";

export type StudentField =
  | "fullName"
  | "gradeOrAge"
  | "examTrack"
  | "targetScore"
  | "parentName"
  | "parentPhone"
  | "parentLanguage"
  | "notes";

export type StudentErrorKey =
  | "nameRequired"
  | "nameTooLong"
  | "tooLong"
  | "phoneInvalid"
  | "examInvalid"
  | "languageInvalid"
  | "generic"
  | "notFound";

export type StudentFormState = {
  fieldErrors?: Partial<Record<StudentField, StudentErrorKey>>;
  formError?: StudentErrorKey;
};

/** Creates a student, or updates one when the form has an "id". */
export async function saveStudent(
  _prev: StudentFormState,
  formData: FormData,
): Promise<StudentFormState> {
  const locale = await getLocale();
  const user = await getUser();
  if (!user) return redirect({ href: "/login", locale });

  const id = formText(formData, "id");
  if (id && !isUuid(id)) return { formError: "notFound" };

  const fullName = formText(formData, "fullName");
  const gradeOrAge = formText(formData, "gradeOrAge");
  const examTrack = formText(formData, "examTrack");
  const targetScore = formText(formData, "targetScore");
  const parentName = formText(formData, "parentName");
  const parentPhone = formText(formData, "parentPhone");
  const parentLanguage = formText(formData, "parentLanguage");
  const notes = formText(formData, "notes");

  const fieldErrors: StudentFormState["fieldErrors"] = {};
  if (!fullName) fieldErrors.fullName = "nameRequired";
  else if (fullName.length > LIMITS.name) fieldErrors.fullName = "nameTooLong";
  if (gradeOrAge.length > LIMITS.short) fieldErrors.gradeOrAge = "tooLong";
  if (!isExam(examTrack)) fieldErrors.examTrack = "examInvalid";
  if (targetScore.length > LIMITS.short) fieldErrors.targetScore = "tooLong";
  if (parentName.length > LIMITS.name) fieldErrors.parentName = "tooLong";
  if (parentPhone && !isValidPhone(parentPhone)) fieldErrors.parentPhone = "phoneInvalid";
  if (!isOutputLanguage(parentLanguage)) fieldErrors.parentLanguage = "languageInvalid";
  if (notes.length > LIMITS.long) fieldErrors.notes = "tooLong";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const row = {
    full_name: fullName,
    grade_or_age: gradeOrAge || null,
    exam_track: examTrack,
    target_score: targetScore || null,
    parent_name: parentName || null,
    parent_phone: parentPhone || null,
    parent_language: parentLanguage,
    notes: notes || null,
  };

  const supabase = await createClient();
  let savedId = id;

  if (id) {
    const { data, error } = await supabase
      .from("students")
      .update(row)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("updateStudent failed", error);
      return { formError: "generic" };
    }
    if (!data) return { formError: "notFound" }; // not this tutor's student (RLS) or deleted
  } else {
    const { data, error } = await supabase
      .from("students")
      .insert({ ...row, tutor_id: user.id })
      .select("id")
      .single();
    if (error || !data) {
      console.error("createStudent failed", error);
      return { formError: "generic" };
    }
    savedId = data.id as string;
  }

  revalidatePath("/", "layout");
  return redirect({ href: `/students/${savedId}`, locale });
}

/** Deletes a student and (via ON DELETE CASCADE) all their lessons. */
export async function deleteStudent(id: string): Promise<void> {
  const locale = await getLocale();
  if (!isUuid(id)) return redirect({ href: "/students", locale });

  const supabase = await createClient();
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) {
    console.error("deleteStudent failed", error);
    throw new Error("deleteStudent failed");
  }

  revalidatePath("/", "layout");
  redirect({ href: "/students", locale });
}
