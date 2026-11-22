"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";
import { aqylbekErrorMessage, callAqylbek } from "@/lib/aqylbek";
import { getReport, getStudent, listReportsForWeek, listStudents } from "@/lib/data";
import { collectWeekData } from "@/lib/report-data";
import { isEmptyWeek } from "@/lib/report-input";
import { createClient } from "@/lib/supabase/server";
import { REPORT_MESSAGE_MAX } from "@/lib/constants";
import { formText, isUuid } from "@/lib/validation";
import { isDateKey, startOfWeek } from "@/lib/time";

function validWeek(week: string): boolean {
  return isDateKey(week) && startOfWeek(week) === week;
}

/** Students that still need a draft for this week (no report yet, or only a draft). */
export async function listDraftTargets(week: string): Promise<string[]> {
  if (!validWeek(week)) return [];
  const [students, reports] = await Promise.all([listStudents(), listReportsForWeek(week)]);
  const locked = new Set(reports.filter((r) => r.status !== "draft").map((r) => r.student_id));
  return students.filter((s) => !locked.has(s.id)).map((s) => s.id);
}

export type DraftResult =
  | { ok: true; status: "ok" | "needs_data" | "empty" }
  | { ok: false; message: string };

/**
 * Drafts (or re-drafts) one student's report for one week. Called once per student from the
 * browser, so a long list never hits a server time limit and the tutor sees progress.
 * Approved or sent reports are never overwritten.
 */
export async function draftReport(studentId: string, week: string): Promise<DraftResult> {
  const locale = await getLocale();
  const user = await getUser();
  if (!user) return { ok: false, message: await aqylbekErrorMessage("unauthorized", locale) };

  const student = isUuid(studentId) ? await getStudent(studentId) : null;
  if (!student || !validWeek(week)) return { ok: false, message: await aqylbekErrorMessage("invalidTask", locale) };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("reports")
    .select("id, status")
    .eq("student_id", student.id)
    .eq("week_start", week)
    .maybeSingle();
  if (existing && existing.status !== "draft") return { ok: true, status: "ok" }; // leave approved/sent alone

  const input = await collectWeekData(student, week);

  let row: { ai_status: "ok" | "needs_data"; missing: string[]; message: string | null };
  let resultStatus: "ok" | "needs_data" | "empty";

  if (isEmptyWeek(input)) {
    // Nothing happened this week: don't spend an AI call. The UI explains what's missing.
    row = { ai_status: "needs_data", missing: [], message: null };
    resultStatus = "empty";
  } else {
    const result = await callAqylbek({ mode: "parent_report", output_language: student.parent_language, ...input });
    if (!result.ok) return { ok: false, message: await aqylbekErrorMessage(result.error, locale) };

    if (result.data.status === "needs_data") {
      row = {
        ai_status: "needs_data",
        missing: result.data.missing.map((m) => m.trim()).filter(Boolean).slice(0, 20).map((m) => m.slice(0, 300)),
        message: null,
      };
      resultStatus = "needs_data";
    } else {
      row = { ai_status: "ok", missing: [], message: result.data.message.trim().slice(0, REPORT_MESSAGE_MAX) };
      resultStatus = "ok";
    }
  }

  const { error } = existing
    ? await supabase
        .from("reports")
        .update({ input_data: input, ...row })
        .eq("id", existing.id)
        .eq("status", "draft")
    : await supabase.from("reports").insert({
        tutor_id: user.id,
        student_id: student.id,
        week_start: week,
        input_data: input,
        status: "draft",
        ...row,
      });
  if (error) {
    console.error("draftReport save failed", error.code, error.message);
    return { ok: false, message: await aqylbekErrorMessage("failed", locale) };
  }

  revalidatePath("/", "layout");
  return { ok: true, status: resultStatus };
}

// ---------------------------------------------------------------------------------------------
// Edit & approve
// ---------------------------------------------------------------------------------------------

export type ReportSaveErrorKey = "messageRequired" | "tooLong" | "notEditable" | "generic";
export type ReportSaveState = { error?: ReportSaveErrorKey; saved?: boolean };

export async function saveReport(_prev: ReportSaveState, formData: FormData): Promise<ReportSaveState> {
  const locale = await getLocale();
  const report = await getReport(formText(formData, "id"));
  if (!report || report.status !== "draft") return { error: "notEditable" };

  const approve = formText(formData, "intent") === "approve";
  const message = formText(formData, "message");
  if (message.length > REPORT_MESSAGE_MAX) return { error: "tooLong" };
  if (approve && !message) return { error: "messageRequired" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .update({
      message: message || null,
      ...(approve
        ? {
            status: "approved",
            approved_at: new Date().toISOString(),
            share_token: report.share_token ?? randomUUID(), // keep the old link if re-approving
          }
        : {}),
    })
    .eq("id", report.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("saveReport failed", error.code, error.message);
    return { error: "generic" };
  }

  revalidatePath("/", "layout");
  if (approve) return redirect({ href: `/reports/${report.id}`, locale });
  return { saved: true };
}

/** Back to draft: the share link stops working until approved again. */
export async function reopenReport(id: string): Promise<{ ok: boolean }> {
  if (!isUuid(id)) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ status: "draft", approved_at: null, sent_at: null })
    .eq("id", id)
    .in("status", ["approved", "sent"]);
  revalidatePath("/", "layout");
  return { ok: !error };
}

/** Called when the tutor copies the WhatsApp text or opens WhatsApp. */
export async function markReportSent(id: string): Promise<{ ok: boolean }> {
  if (!isUuid(id)) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "approved");
  revalidatePath("/", "layout");
  return { ok: !error };
}

/** New random token: the old link stops working immediately. */
export async function resetShareLink(id: string): Promise<{ ok: boolean }> {
  if (!isUuid(id)) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ share_token: randomUUID() })
    .eq("id", id)
    .in("status", ["approved", "sent"]);
  revalidatePath("/", "layout");
  return { ok: !error };
}

export async function deleteReport(id: string): Promise<void> {
  const locale = await getLocale();
  const report = await getReport(id);
  const back = report ? `/reports?week=${report.week_start}` : "/reports";
  if (report) {
    const supabase = await createClient();
    const { error } = await supabase.from("reports").delete().eq("id", report.id);
    if (error) {
      console.error("deleteReport failed", error.code, error.message);
      throw new Error("deleteReport failed");
    }
  }
  revalidatePath("/", "layout");
  redirect({ href: back, locale });
}
