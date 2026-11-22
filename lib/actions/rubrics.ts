"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getRubric } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isExam, type Rubric } from "@/lib/constants";
import { RUBRIC_LIMITS, isValidScale, parseCriteria } from "@/lib/rubrics";
import { formText, isUuid } from "@/lib/validation";
import { isDateKey, todayKey } from "@/lib/time";

export type RubricField =
  | "exam"
  | "taskType"
  | "name"
  | "version"
  | "scale"
  | "overallRule"
  | "sourceUrl"
  | "lastVerified"
  | "criteria";

export type RubricErrorKey =
  | "required"
  | "tooLong"
  | "examInvalid"
  | "scaleInvalid"
  | "urlInvalid"
  | "dateInvalid"
  | "criteriaRequired"
  | "criteriaInvalid"
  | "duplicateName"
  | "forbidden"
  | "adminNotConfigured"
  | "generic"
  | "notFound";

export type RubricFormState = {
  fieldErrors?: Partial<Record<RubricField, RubricErrorKey>>;
  formError?: RubricErrorKey;
};

type DbError = { code?: string; message: string } | null;

function checkText(value: string, max: number): RubricErrorKey | undefined {
  if (!value) return "required";
  if (value.length > max) return "tooLong";
  return undefined;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function dbErrorToState(error: NonNullable<DbError>): RubricFormState {
  if (error.code === "23505") return { fieldErrors: { name: "duplicateName" } };
  if (error.code === "23514") return { fieldErrors: { criteria: "criteriaInvalid" } };
  console.error("saveRubric failed", error);
  return { formError: "generic" };
}

/** Creates or updates a rubric. Platform rubrics (owner null) go through the admin client. */
export async function saveRubric(
  _prev: RubricFormState,
  formData: FormData,
): Promise<RubricFormState> {
  const locale = await getLocale();
  const user = await getUser();
  if (!user) return redirect({ href: "/login", locale });
  const admin = isAdmin(user);

  const id = formText(formData, "id");
  if (id && !isUuid(id)) return { formError: "notFound" };

  const exam = formText(formData, "exam");
  const taskType = formText(formData, "taskType");
  const name = formText(formData, "name");
  const version = formText(formData, "version");
  const minText = formText(formData, "scaleMin");
  const maxText = formText(formData, "scaleMax");
  const stepText = formText(formData, "scaleStep");
  const overallRule = formText(formData, "overallRule");
  const sourceUrl = formText(formData, "sourceUrl");
  const lastVerified = formText(formData, "lastVerified");
  const wantsPlatform = formData.get("platform") === "on";

  const scale = { min: Number(minText), max: Number(maxText), step: Number(stepText) };
  const fieldErrors: RubricFormState["fieldErrors"] = {};

  if (!isExam(exam)) fieldErrors.exam = "examInvalid";
  const taskTypeError = checkText(taskType, RUBRIC_LIMITS.taskType);
  if (taskTypeError) fieldErrors.taskType = taskTypeError;
  const nameError = checkText(name, RUBRIC_LIMITS.name);
  if (nameError) fieldErrors.name = nameError;
  const versionError = checkText(version, RUBRIC_LIMITS.version);
  if (versionError) fieldErrors.version = versionError;
  if (!minText || !maxText || !stepText || !isValidScale(scale.min, scale.max, scale.step)) {
    fieldErrors.scale = "scaleInvalid";
  }
  const ruleError = checkText(overallRule, RUBRIC_LIMITS.overallRule);
  if (ruleError) fieldErrors.overallRule = ruleError;
  if (sourceUrl && (sourceUrl.length > RUBRIC_LIMITS.url || !isHttpUrl(sourceUrl))) {
    fieldErrors.sourceUrl = "urlInvalid";
  }
  // Plain "YYYY-MM-DD" strings compare correctly; "today" is the Almaty date.
  if (lastVerified && (!isDateKey(lastVerified) || lastVerified > todayKey())) {
    fieldErrors.lastVerified = "dateInvalid";
  }

  const rawCriteria = formText(formData, "criteria");
  const criteria = fieldErrors.scale ? null : parseCriteria(rawCriteria, scale);
  if (!fieldErrors.scale && !criteria) {
    fieldErrors.criteria = rawCriteria === "[]" ? "criteriaRequired" : "criteriaInvalid";
  }

  if (Object.keys(fieldErrors).length > 0 || !criteria) return { fieldErrors };

  const row = {
    exam,
    task_type: taskType,
    name,
    version,
    scale_min: scale.min,
    scale_max: scale.max,
    scale_step: scale.step,
    overall_rule: overallRule,
    criteria,
    source_url: sourceUrl || null,
    last_verified: lastVerified || null,
  };

  const supabase = await createClient();
  let savedId = id;

  if (id) {
    const existing = await getRubric(id); // RLS: only platform rubrics and the tutor's own
    if (!existing) return { formError: "notFound" };

    if (existing.owner === null) {
      if (!admin) return { formError: "forbidden" };
      const adminDb = createAdminClient();
      if (!adminDb) return { formError: "adminNotConfigured" };
      const { data, error } = await adminDb
        .from("rubrics")
        .update(row)
        .eq("id", id)
        .is("owner", null) // the admin path can never touch a tutor's own rubric
        .select("id")
        .maybeSingle();
      if (error) return dbErrorToState(error);
      if (!data) return { formError: "notFound" };
    } else if (existing.owner === user.id) {
      const { data, error } = await supabase
        .from("rubrics")
        .update(row)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) return dbErrorToState(error);
      if (!data) return { formError: "notFound" };
    } else {
      return { formError: "forbidden" };
    }
  } else if (wantsPlatform) {
    if (!admin) return { formError: "forbidden" };
    const adminDb = createAdminClient();
    if (!adminDb) return { formError: "adminNotConfigured" };
    const { data, error } = await adminDb
      .from("rubrics")
      .insert({ ...row, owner: null })
      .select("id")
      .single();
    if (error || !data) return error ? dbErrorToState(error) : { formError: "generic" };
    savedId = data.id as string;
  } else {
    const { data, error } = await supabase
      .from("rubrics")
      .insert({ ...row, owner: user.id })
      .select("id")
      .single();
    if (error || !data) return error ? dbErrorToState(error) : { formError: "generic" };
    savedId = data.id as string;
  }

  revalidatePath("/", "layout");
  return redirect({ href: `/rubrics/${savedId}`, locale });
}

export async function deleteRubric(id: string): Promise<void> {
  const locale = await getLocale();
  const user = await getUser();
  if (!user) return redirect({ href: "/login", locale });

  const existing = isUuid(id) ? await getRubric(id) : null;
  if (!existing) return redirect({ href: "/rubrics", locale });

  let error: DbError = null;
  if (existing.owner === null) {
    const adminDb = isAdmin(user) ? createAdminClient() : null;
    if (!adminDb) throw new Error("Not allowed to delete platform rubrics");
    ({ error } = await adminDb.from("rubrics").delete().eq("id", id).is("owner", null));
  } else {
    const supabase = await createClient();
    ({ error } = await supabase.from("rubrics").delete().eq("id", id));
  }
  if (error) {
    console.error("deleteRubric failed", error);
    throw new Error("deleteRubric failed");
  }

  revalidatePath("/", "layout");
  redirect({ href: "/rubrics", locale });
}

/** Copies any readable rubric (usually a platform one) into the tutor's own rubrics. */
export async function duplicateRubric(id: string): Promise<{ ok: false }> {
  const locale = await getLocale();
  const user = await getUser();
  if (!user) return redirect({ href: "/login", locale });

  const source: Rubric | null = isUuid(id) ? await getRubric(id) : null;
  if (!source) return { ok: false };

  const t = await getTranslations("rubrics");
  const supabase = await createClient();
  const base = {
    owner: user.id,
    exam: source.exam,
    task_type: source.task_type,
    version: source.version,
    scale_min: source.scale_min,
    scale_max: source.scale_max,
    scale_step: source.scale_step,
    overall_rule: source.overall_rule,
    criteria: source.criteria,
    source_url: source.source_url,
    last_verified: source.last_verified,
  };

  // "Name (copy)", then "Name (copy) 2", … if that name + version already exists.
  for (let attempt = 1; attempt <= 5; attempt++) {
    const suffix = attempt === 1 ? t("copySuffix") : `${t("copySuffix")} ${attempt}`;
    const name = `${source.name} ${suffix}`.slice(0, RUBRIC_LIMITS.name);
    const { data, error } = await supabase
      .from("rubrics")
      .insert({ ...base, name })
      .select("id")
      .single();
    if (data) {
      revalidatePath("/", "layout");
      return redirect({ href: `/rubrics/${data.id}/edit`, locale });
    }
    if (error?.code !== "23505") {
      console.error("duplicateRubric failed", error);
      return { ok: false };
    }
  }
  return { ok: false };
}
