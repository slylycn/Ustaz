"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getTutor, getUser } from "@/lib/auth";
import { aqylbekErrorMessage, callAqylbek, type AqylbekFile } from "@/lib/aqylbek";
import { getHomework, getStudent } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { sniffMime } from "@/lib/submission-files";
import { isExam, type Exam, type Tutor } from "@/lib/constants";
import {
  HOMEWORK_LIMITS,
  HOMEWORK_SOURCE_TYPES,
  fromAi,
  isHomeworkItemType,
  parseHomeworkEdit,
  type HomeworkEditError,
  type HomeworkItemType,
} from "@/lib/homework";
import { formText, isUuid } from "@/lib/validation";
import { isDateKey } from "@/lib/time";

const BUCKET = "homework";
const SOURCE_EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

// ---------------------------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------------------------

export type GenerateField = "topic" | "exam" | "level" | "itemCount" | "itemTypes" | "studentId" | "files";
export type GenerateErrorKey =
  | "topicRequired"
  | "tooLong"
  | "examInvalid"
  | "countInvalid"
  | "typesRequired"
  | "studentInvalid"
  | "fileInvalid"
  | "fileTooLarge"
  | "tooManyFiles"
  | "generic";

export type GenerateState = {
  fieldErrors?: Partial<Record<GenerateField, GenerateErrorKey>>;
  /** Already-translated message (e.g. "Aqylbek is busy, try again in a minute"). */
  message?: string;
};

type Params = { exam: Exam; level: string | null; topic: string; itemCount: number; itemTypes: HomeworkItemType[] };

/** Downloads (and re-checks) source files from the tutor's private folder for Aqylbek. */
async function loadSources(paths: string[]): Promise<AqylbekFile[] | null> {
  const supabase = await createClient();
  const files: AqylbekFile[] = [];
  for (const path of paths) {
    const { data: blob, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !blob || blob.size > HOMEWORK_LIMITS.sourceFileBytes) return null;
    const buffer = Buffer.from(await blob.arrayBuffer());
    const declared = HOMEWORK_SOURCE_TYPES[path.split(".").pop() as keyof typeof HOMEWORK_SOURCE_TYPES];
    const mime = declared ? sniffMime(buffer, declared) : null;
    if (!mime) return null;
    files.push({ mimeType: mime, data: buffer.toString("base64") });
  }
  return files;
}

async function askAqylbek(tutor: Tutor, params: Params, files: AqylbekFile[]) {
  return callAqylbek(
    {
      mode: "homework",
      output_language: tutor.output_language,
      exam: params.exam,
      level: params.level,
      topic: params.topic,
      item_count: params.itemCount,
      item_types: params.itemTypes,
      source_file_count: files.length,
    },
    files,
  );
}

/**
 * The browser has already uploaded source files to "<tutor>/<homework id>/source-<n>.<ext>".
 * This validates the form, asks Aqylbek, splits the answer key out, and saves a draft.
 */
export async function generateHomework(formData: FormData): Promise<GenerateState> {
  const locale = await getLocale();
  const user = await getUser();
  const tutor = await getTutor();
  if (!user || !tutor) return redirect({ href: "/login", locale });

  const id = formText(formData, "id");
  const topic = formText(formData, "topic");
  const exam = formText(formData, "exam");
  const level = formText(formData, "level");
  const itemCount = Number(formText(formData, "itemCount"));
  const itemTypes = [...new Set(formData.getAll("itemTypes").map(String))];
  const studentId = formText(formData, "studentId");
  const paths = formData.getAll("sourcePaths").map(String).filter(Boolean);

  const supabase = await createClient();
  const removeUploads = async () => {
    const own = paths.filter((p) => p.startsWith(`${user.id}/`));
    if (own.length) await supabase.storage.from(BUCKET).remove(own);
  };

  const fieldErrors: GenerateState["fieldErrors"] = {};
  if (!isUuid(id)) return { fieldErrors: { topic: "generic" } };
  if (!topic) fieldErrors.topic = "topicRequired";
  else if (topic.length > HOMEWORK_LIMITS.topic) fieldErrors.topic = "tooLong";
  if (!isExam(exam)) fieldErrors.exam = "examInvalid";
  if (level.length > HOMEWORK_LIMITS.level) fieldErrors.level = "tooLong";
  if (!Number.isInteger(itemCount) || itemCount < 1 || itemCount > HOMEWORK_LIMITS.items) fieldErrors.itemCount = "countInvalid";
  if (itemTypes.length === 0 || !itemTypes.every(isHomeworkItemType)) fieldErrors.itemTypes = "typesRequired";
  if (studentId && (!isUuid(studentId) || !(await getStudent(studentId)))) fieldErrors.studentId = "studentInvalid";
  if (paths.length > HOMEWORK_LIMITS.sourceFiles) fieldErrors.files = "tooManyFiles";
  else if (
    !paths.every((p, i) => {
      const ext = p.split(".").pop() ?? "";
      return p === `${user.id}/${id}/source-${i + 1}.${ext}` && Object.values(SOURCE_EXT).includes(ext);
    })
  ) {
    fieldErrors.files = "fileInvalid";
  }

  let files: AqylbekFile[] = [];
  if (!fieldErrors.files && paths.length > 0) {
    const loaded = await loadSources(paths);
    if (!loaded) fieldErrors.files = "fileInvalid";
    else files = loaded;
  }

  if (Object.keys(fieldErrors).length > 0) {
    await removeUploads();
    return { fieldErrors };
  }

  const params: Params = {
    exam: exam as Exam,
    level: level || null,
    topic,
    itemCount,
    itemTypes: itemTypes as HomeworkItemType[],
  };
  const result = await askAqylbek(tutor, params, files);
  if (!result.ok) {
    await removeUploads();
    return { message: await aqylbekErrorMessage(result.error, locale) };
  }

  const { title, sheet, key } = fromAi(result.data);
  const { error } = await supabase.from("homework").insert({
    id,
    tutor_id: user.id,
    student_id: studentId || null,
    title,
    exam: params.exam,
    level: params.level,
    topic: params.topic,
    item_types: params.itemTypes,
    item_count: params.itemCount,
    student_sheet: sheet,
    teacher_key: key,
    source_files: paths,
    status: "draft",
  });
  if (error) {
    console.error("generateHomework insert failed", error.code, error.message);
    await removeUploads();
    return { fieldErrors: { topic: "generic" } };
  }

  revalidatePath("/", "layout");
  return redirect({ href: `/homework/${id}`, locale });
}

/** Draft only: asks Aqylbek again with the same settings and sources, replacing the items. */
export async function regenerateHomework(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const locale = await getLocale();
  const tutor = await getTutor();
  const homework = await getHomework(id);
  if (!tutor || !homework || homework.status !== "draft" || !homework.topic || !homework.item_count) {
    return { ok: false, message: await aqylbekErrorMessage("invalidTask", locale) };
  }

  const files = homework.source_files.length ? await loadSources(homework.source_files) : [];
  if (!files) return { ok: false, message: await aqylbekErrorMessage("invalidTask", locale) };

  const result = await askAqylbek(
    tutor,
    {
      exam: homework.exam,
      level: homework.level,
      topic: homework.topic,
      itemCount: homework.item_count,
      itemTypes: homework.item_types,
    },
    files,
  );
  if (!result.ok) return { ok: false, message: await aqylbekErrorMessage(result.error, locale) };

  const { title, sheet, key } = fromAi(result.data);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("homework")
    .update({ title, student_sheet: sheet, teacher_key: key })
    .eq("id", homework.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("regenerateHomework failed", error.code, error.message);
    return { ok: false, message: await aqylbekErrorMessage("failed", locale) };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Edit / assign / delete
// ---------------------------------------------------------------------------------------------

export type HomeworkSaveErrorKey = HomeworkEditError | "notEditable" | "studentInvalid" | "dateInvalid" | "generic";
export type HomeworkSaveState = { error?: HomeworkSaveErrorKey };

/** Saves the tutor's edits. Only drafts can be edited ("Back to draft" first if assigned). */
export async function saveHomework(_prev: HomeworkSaveState, formData: FormData): Promise<HomeworkSaveState> {
  const locale = await getLocale();
  const id = formText(formData, "id");
  const homework = await getHomework(id);
  if (!homework || homework.status !== "draft") return { error: "notEditable" };

  const parsed = parseHomeworkEdit(formText(formData, "content"));
  if (!parsed.ok) return { error: parsed.error };

  const studentId = formText(formData, "studentId");
  if (studentId && (!isUuid(studentId) || !(await getStudent(studentId)))) return { error: "studentInvalid" };
  const dueDate = formText(formData, "dueDate");
  if (dueDate && !isDateKey(dueDate)) return { error: "dateInvalid" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("homework")
    .update({
      title: parsed.title,
      student_sheet: parsed.sheet,
      teacher_key: parsed.key,
      student_id: studentId || null,
      due_date: dueDate || null,
    })
    .eq("id", homework.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("saveHomework failed", error.code, error.message);
    return { error: "generic" };
  }

  revalidatePath("/", "layout");
  return redirect({ href: `/homework/${homework.id}`, locale });
}

export async function assignHomework(id: string): Promise<{ ok: boolean; error?: "needsStudent" | "generic" }> {
  const homework = await getHomework(id);
  if (!homework || homework.status !== "draft") return { ok: false, error: "generic" };
  if (!homework.student_id) return { ok: false, error: "needsStudent" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("homework")
    .update({ status: "assigned", assigned_at: new Date().toISOString() })
    .eq("id", homework.id)
    .eq("status", "draft");
  if (error) {
    console.error("assignHomework failed", error.code, error.message);
    return { ok: false, error: "generic" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function unassignHomework(id: string): Promise<{ ok: boolean }> {
  if (!isUuid(id)) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("homework")
    .update({ status: "draft", assigned_at: null })
    .eq("id", id)
    .eq("status", "assigned");
  if (error) console.error("unassignHomework failed", error.code, error.message);
  revalidatePath("/", "layout");
  return { ok: !error };
}

export async function deleteHomework(id: string): Promise<void> {
  const locale = await getLocale();
  const homework = await getHomework(id);
  if (!homework) return redirect({ href: "/homework", locale });

  const supabase = await createClient();
  const { error } = await supabase.from("homework").delete().eq("id", homework.id);
  if (error) {
    console.error("deleteHomework failed", error.code, error.message);
    throw new Error("deleteHomework failed");
  }
  if (homework.source_files.length) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(homework.source_files);
    if (storageError) console.error("deleteHomework: files not removed", storageError.message);
  }

  revalidatePath("/", "layout");
  redirect({ href: "/homework", locale });
}
