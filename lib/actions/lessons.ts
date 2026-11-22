"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LIMITS } from "@/lib/constants";
import { formText, isUuid, safeReturnTo } from "@/lib/validation";
import { isDateKey, isTimeKey, startOfWeek, zonedToUtc } from "@/lib/time";

export type LessonField =
  | "studentId"
  | "date"
  | "time"
  | "durationMin"
  | "topic"
  | "attended"
  | "tutorNote";

export type LessonErrorKey =
  | "studentRequired"
  | "dateInvalid"
  | "timeInvalid"
  | "durationInvalid"
  | "tooLong"
  | "generic"
  | "notFound";

export type LessonFormState = {
  fieldErrors?: Partial<Record<LessonField, LessonErrorKey>>;
  formError?: LessonErrorKey;
};

function parseAttended(value: string): boolean | null | undefined {
  if (value === "") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined; // invalid
}

/** Creates a lesson, or updates one when the form has an "id". Date + time are Almaty wall-clock. */
export async function saveLesson(
  _prev: LessonFormState,
  formData: FormData,
): Promise<LessonFormState> {
  const locale = await getLocale();
  const user = await getUser();
  if (!user) return redirect({ href: "/login", locale });

  const id = formText(formData, "id");
  if (id && !isUuid(id)) return { formError: "notFound" };

  const studentId = formText(formData, "studentId");
  const date = formText(formData, "date");
  const time = formText(formData, "time");
  const durationMin = Number(formText(formData, "durationMin"));
  const topic = formText(formData, "topic");
  const attended = parseAttended(formText(formData, "attended"));
  const tutorNote = formText(formData, "tutorNote");

  const fieldErrors: LessonFormState["fieldErrors"] = {};
  if (!isUuid(studentId)) fieldErrors.studentId = "studentRequired";
  if (!isDateKey(date)) fieldErrors.date = "dateInvalid";
  if (!isTimeKey(time)) fieldErrors.time = "timeInvalid";
  if (!Number.isInteger(durationMin) || durationMin < 15 || durationMin > 480) {
    fieldErrors.durationMin = "durationInvalid";
  }
  if (topic.length > LIMITS.topic) fieldErrors.topic = "tooLong";
  if (attended === undefined) fieldErrors.attended = "generic";
  if (tutorNote.length > LIMITS.long) fieldErrors.tutorNote = "tooLong";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const row = {
    student_id: studentId,
    starts_at: zonedToUtc(date, time).toISOString(),
    duration_min: durationMin,
    topic: topic || null,
    attended: attended ?? null,
    tutor_note: tutorNote || null,
  };

  const supabase = await createClient();

  if (id) {
    const { data, error } = await supabase
      .from("lessons")
      .update(row)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) return lessonError(error);
    if (!data) return { formError: "notFound" };
  } else {
    const { error } = await supabase.from("lessons").insert({ ...row, tutor_id: user.id });
    if (error) return lessonError(error);
  }

  revalidatePath("/", "layout");
  const fallback = `/timetable?week=${startOfWeek(date)}`;
  return redirect({ href: safeReturnTo(formText(formData, "returnTo"), fallback), locale });
}

function lessonError(error: { code?: string; message: string }): LessonFormState {
  // 23503 = foreign key violation: the student doesn't exist or belongs to another tutor.
  if (error.code === "23503") return { fieldErrors: { studentId: "studentRequired" } };
  console.error("saveLesson failed", error);
  return { formError: "generic" };
}

export async function deleteLesson(id: string, returnTo?: string): Promise<void> {
  const locale = await getLocale();
  const target = safeReturnTo(returnTo, "/timetable");
  if (!isUuid(id)) return redirect({ href: target, locale });

  const supabase = await createClient();
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  if (error) {
    console.error("deleteLesson failed", error);
    throw new Error("deleteLesson failed");
  }

  revalidatePath("/", "layout");
  redirect({ href: target, locale });
}

/** Quick attendance mark from the timetable or a student profile. null clears the mark. */
export async function setLessonAttendance(
  id: string,
  attended: boolean | null,
): Promise<{ ok: boolean }> {
  if (!isUuid(id) || !(attended === null || typeof attended === "boolean")) {
    return { ok: false };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lessons")
    .update({ attended })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("setLessonAttendance failed", error);
    return { ok: false };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
