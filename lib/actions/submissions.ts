"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getTutor, getUser } from "@/lib/auth";
import { aqylbekErrorMessage, callAqylbek, type AqylbekFile } from "@/lib/aqylbek";
import { getRubric, getStudent, getSubmission } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { extractDocxText, sniffMime } from "@/lib/submission-files";
import {
  DOCX_MIME,
  MAX_SUBMISSION_FILE_BYTES,
  SUBMISSION_FILE_TYPES,
  SUBMISSION_LIMITS,
  type SubmissionMime,
} from "@/lib/constants";
import { draftFromAi, isComplete, parseReview, scaleOf, snapshotRubric, type RubricSnapshot } from "@/lib/grading";
import { formText, isUuid } from "@/lib/validation";

const BUCKET = "submissions";

// ---------------------------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------------------------

export type NewSubmissionField = "studentId" | "rubricId" | "taskPrompt" | "work";
export type NewSubmissionErrorKey =
  | "studentRequired"
  | "rubricRequired"
  | "taskRequired"
  | "tooLong"
  | "workRequired"
  | "fileInvalid"
  | "fileTooLarge"
  | "docxUnreadable"
  | "textTooLong"
  | "generic";

export type NewSubmissionState = {
  fieldErrors?: Partial<Record<NewSubmissionField, NewSubmissionErrorKey>>;
  formError?: NewSubmissionErrorKey;
};

const MIME_EXT = Object.fromEntries(
  Object.entries(SUBMISSION_FILE_TYPES).filter(([ext]) => ext !== "jpeg").map(([ext, mime]) => [mime, ext]),
) as Record<SubmissionMime, string>;

/** Storage object name for a submission's file. Must match the folder rule in the SQL policies. */
function expectedPath(tutorId: string, submissionId: string, mime: SubmissionMime) {
  return `${tutorId}/${submissionId}/work.${MIME_EXT[mime]}`;
}

/**
 * The browser has already uploaded the file (if any) straight to Storage under the tutor's
 * folder, so large files never pass through this function. Here we verify the file, extract
 * DOCX text, and create the row.
 */
export async function createSubmission(
  _prev: NewSubmissionState,
  formData: FormData,
): Promise<NewSubmissionState> {
  const locale = await getLocale();
  const user = await getUser();
  if (!user) return redirect({ href: "/login", locale });

  const id = formText(formData, "id");
  const studentId = formText(formData, "studentId");
  const rubricId = formText(formData, "rubricId");
  const taskPrompt = formText(formData, "taskPrompt");
  const workType = formText(formData, "workType"); // "file" | "text"
  const pastedText = formText(formData, "text");
  const filePath = formText(formData, "filePath");
  const declaredMime = formText(formData, "fileMime");

  const fieldErrors: NewSubmissionState["fieldErrors"] = {};
  if (!isUuid(id)) return { formError: "generic" };
  if (!isUuid(studentId) || !(await getStudent(studentId))) fieldErrors.studentId = "studentRequired";
  if (!isUuid(rubricId) || !(await getRubric(rubricId))) fieldErrors.rubricId = "rubricRequired";
  if (!taskPrompt) fieldErrors.taskPrompt = "taskRequired";
  else if (taskPrompt.length > SUBMISSION_LIMITS.taskPrompt) fieldErrors.taskPrompt = "tooLong";

  let textContent: string | null = null;
  let fileMime: SubmissionMime | null = null;
  const supabase = await createClient();
  const removeUpload = async () => {
    if (filePath.startsWith(`${user.id}/`)) await supabase.storage.from(BUCKET).remove([filePath]);
  };

  if (workType === "text") {
    if (!pastedText) fieldErrors.work = "workRequired";
    else if (pastedText.length > SUBMISSION_LIMITS.text) fieldErrors.work = "textTooLong";
    else textContent = pastedText;
  } else if (workType === "file") {
    const mime = Object.values(SUBMISSION_FILE_TYPES).find((m) => m === declaredMime);
    if (!mime || filePath !== expectedPath(user.id, id, mime)) {
      fieldErrors.work = "fileInvalid";
    } else {
      // Download with the tutor's session: Storage RLS only allows their own folder.
      const { data: blob, error } = await supabase.storage.from(BUCKET).download(filePath);
      if (error || !blob) {
        fieldErrors.work = "fileInvalid";
      } else if (blob.size > MAX_SUBMISSION_FILE_BYTES) {
        fieldErrors.work = "fileTooLarge";
      } else {
        const buffer = Buffer.from(await blob.arrayBuffer());
        fileMime = sniffMime(buffer, mime);
        if (!fileMime) {
          fieldErrors.work = "fileInvalid";
        } else if (fileMime === DOCX_MIME) {
          try {
            const extracted = await extractDocxText(buffer);
            if (!extracted) fieldErrors.work = "docxUnreadable";
            else if (extracted.length > SUBMISSION_LIMITS.text) fieldErrors.work = "textTooLong";
            else textContent = extracted;
          } catch {
            fieldErrors.work = "docxUnreadable";
          }
        }
      }
    }
  } else {
    fieldErrors.work = "workRequired";
  }

  if (Object.keys(fieldErrors).length > 0) {
    await removeUpload(); // the browser uploads again on the next try
    return { fieldErrors };
  }

  const { error } = await supabase.from("submissions").insert({
    id,
    tutor_id: user.id,
    student_id: studentId,
    rubric_id: rubricId,
    task_prompt: taskPrompt,
    file_path: fileMime ? filePath : null,
    file_mime: fileMime,
    text_content: textContent,
    status: "draft",
  });
  if (error) {
    console.error("createSubmission failed", error.code, error.message);
    await removeUpload();
    return { formError: "generic" };
  }

  revalidatePath("/", "layout");
  return redirect({ href: `/submissions/${id}`, locale });
}

// ---------------------------------------------------------------------------------------------
// Grade with Aqylbek
// ---------------------------------------------------------------------------------------------

export type GradeActionResult = { ok: true } | { ok: false; message: string };

export async function gradeSubmission(id: string): Promise<GradeActionResult> {
  const locale = await getLocale();
  const tutor = await getTutor();
  if (!tutor) return { ok: false, message: await aqylbekErrorMessage("unauthorized", locale) };

  const submission = await getSubmission(id);
  if (!submission) return { ok: false, message: await aqylbekErrorMessage("invalidTask", locale) };
  if (submission.status === "approved") return { ok: false, message: await gradingMessage("alreadyApproved") };

  // Grade against the rubric as it is now; keep the old snapshot only if the rubric was deleted.
  const rubric = submission.rubric_id ? await getRubric(submission.rubric_id) : null;
  const snapshot: RubricSnapshot | null = rubric ? snapshotRubric(rubric) : submission.rubric_snapshot;
  if (!snapshot) return { ok: false, message: await gradingMessage("noRubric") };

  const supabase = await createClient();
  const files: AqylbekFile[] = [];
  if (submission.file_path && submission.file_mime && submission.file_mime !== DOCX_MIME) {
    const { data: blob, error } = await supabase.storage.from(BUCKET).download(submission.file_path);
    if (error || !blob) return { ok: false, message: await gradingMessage("fileMissing") };
    files.push({ mimeType: submission.file_mime, data: Buffer.from(await blob.arrayBuffer()).toString("base64") });
  }

  const scale = scaleOf(snapshot);
  const result = await callAqylbek(
    {
      mode: "grade",
      output_language: tutor.output_language,
      rubric: {
        name: snapshot.name,
        exam: snapshot.exam,
        task_type: snapshot.task_type,
        version: snapshot.version,
        scale,
        overall_rule: snapshot.overall_rule,
        criteria: snapshot.criteria,
      },
      task_prompt: submission.task_prompt,
      student_work: {
        text: submission.text_content,
        attached_file: files.length > 0 ? submission.file_mime : null,
      },
    },
    files,
  );
  if (!result.ok) return { ok: false, message: await aqylbekErrorMessage(result.error, locale) };

  const draft = draftFromAi(result.data, snapshot);
  const { data, error } = await supabase
    .from("submissions")
    .update({
      ai_result: result.data,
      final_result: draft,
      rubric_snapshot: snapshot,
      status: "ai_done",
      graded_at: new Date().toISOString(),
    })
    .eq("id", submission.id)
    .neq("status", "approved")
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("gradeSubmission update failed", error.code, error.message);
    return { ok: false, message: await gradingMessage("generic") };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

async function gradingMessage(key: "alreadyApproved" | "noRubric" | "fileMissing" | "generic") {
  const t = await getTranslations("submission.gradingErrors");
  return t(key);
}

// ---------------------------------------------------------------------------------------------
// Review: save draft / approve / reopen / delete
// ---------------------------------------------------------------------------------------------

export type ReviewErrorKey = "invalid" | "tooLong" | "offScale" | "incomplete" | "notEditable" | "generic";
export type ReviewState = { error?: ReviewErrorKey; saved?: boolean };

export async function saveReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const locale = await getLocale();
  const user = await getUser();
  if (!user) return redirect({ href: "/login", locale });

  const id = formText(formData, "id");
  const intent = formText(formData, "intent") === "approve" ? "approve" : "save";
  const submission = await getSubmission(id);
  if (!submission || submission.status !== "ai_done" || !submission.rubric_snapshot) {
    return { error: "notEditable" };
  }

  const parsed = parseReview(formText(formData, "result"), submission.rubric_snapshot);
  if (!parsed.ok) return { error: parsed.error };
  if (intent === "approve" && !isComplete(parsed.result)) return { error: "incomplete" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("submissions")
    .update({
      final_result: parsed.result,
      ...(intent === "approve" ? { status: "approved", approved_at: new Date().toISOString() } : {}),
    })
    .eq("id", submission.id)
    .eq("status", "ai_done")
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("saveReview failed", error.code, error.message);
    return { error: "generic" };
  }

  revalidatePath("/", "layout");
  if (intent === "approve") return redirect({ href: `/submissions/${submission.id}`, locale });
  return { saved: true };
}

/** Approved → back to review. It stops counting as a grade until approved again. */
export async function reopenSubmission(id: string): Promise<void> {
  if (!isUuid(id)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("submissions")
    .update({ status: "ai_done", approved_at: null })
    .eq("id", id)
    .eq("status", "approved");
  if (error) {
    console.error("reopenSubmission failed", error.code, error.message);
    throw new Error("reopenSubmission failed");
  }
  revalidatePath("/", "layout");
}

export async function deleteSubmission(id: string): Promise<void> {
  const locale = await getLocale();
  const submission = await getSubmission(id);
  if (!submission) return redirect({ href: "/submissions", locale });

  const supabase = await createClient();
  const { error } = await supabase.from("submissions").delete().eq("id", submission.id);
  if (error) {
    console.error("deleteSubmission failed", error.code, error.message);
    throw new Error("deleteSubmission failed");
  }
  if (submission.file_path) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([submission.file_path]);
    if (storageError) console.error("deleteSubmission: file not removed", storageError.message);
  }

  revalidatePath("/", "layout");
  redirect({ href: "/submissions", locale });
}
