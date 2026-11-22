import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI, type Part } from "@google/genai";
import { getTranslations } from "next-intl/server";
import type { Locale } from "next-intl";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAqylbekMode, type AqylbekMode, type AqylbekOutput } from "@/lib/aqylbek-schemas";
import { isBusyError, runAqylbek, type GenerateResult, type RunOutcome, type RunStatus } from "@/lib/aqylbek-core";

/**
 * Aqylbek: the only place in the app that talks to Gemini.
 * Server-only: the API key never reaches the browser, and this module can't be bundled for it.
 *
 * Usage (from a server action or route handler):
 *   const result = await callAqylbek({ mode: "grade", ...task });
 *   if (!result.ok) return { error: await aqylbekErrorMessage(result.error) };
 *   result.data // typed by mode
 */

export type AqylbekFile = {
  mimeType: string;
  /** Base64-encoded file contents (no "data:...;base64," prefix). */
  data: string;
};

export type AqylbekTask<M extends AqylbekMode = AqylbekMode> = {
  mode: M;
  [key: string]: unknown;
};

/** Error codes map 1:1 to messages under "aqylbek.errors" in messages/kk.json and ru.json. */
export type AqylbekErrorCode =
  | "busy"
  | "invalidResponse"
  | "blocked"
  | "notConfigured"
  | "invalidTask"
  | "unauthorized"
  | "failed";

export type AqylbekResult<M extends AqylbekMode> =
  | { ok: true; data: AqylbekOutput<M> }
  | { ok: false; error: AqylbekErrorCode };

// Files: images, PDFs and audio.
// Gemini caps a request with inline data at ~20 MB INCLUDING base64 overhead, so small sets of
// files are sent inline and anything bigger goes through the Gemini Files API (uploaded, used
// for this one call, then deleted).
const ALLOWED_FILE_TYPES = /^(image\/(png|jpeg|webp|heic|heif)|application\/pdf|audio\/(mpeg|mp3|wav|ogg|aac|flac|webm|mp4))$/;
const MAX_FILES = 10;
const MAX_INLINE_BASE64_CHARS = 15_000_000; // ≈ 11 MB of files; leaves room for prompt + task
const MAX_TOTAL_BASE64_CHARS = Math.ceil(40 * 1024 * 1024 * (4 / 3)); // 40 MB of files per call
const FILE_ACTIVE_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 90_000;
// Gemini stopped for safety/policy reasons: retrying the same request won't help.
const BLOCKED_FINISH_REASONS = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII"]);

const PROMPT_PATH = path.join(process.cwd(), "lib", "prompts", "aqylbek-system.md");
const PLACEHOLDER_MARKER = "AQYLBEK_PROMPT_PLACEHOLDER";
let cachedPrompt: string | null = null;

/** Reads lib/prompts/aqylbek-system.md (cached in production, re-read in dev so edits apply). */
async function loadSystemPrompt(): Promise<string | null> {
  if (cachedPrompt && process.env.NODE_ENV === "production") return cachedPrompt;
  try {
    const prompt = (await readFile(PROMPT_PATH, "utf8")).trim();
    if (!prompt || prompt.includes(PLACEHOLDER_MARKER)) return null;
    cachedPrompt = prompt;
    return prompt;
  } catch (error) {
    console.error("Aqylbek: could not read system prompt", (error as Error).message);
    return null;
  }
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  client ??= new GoogleGenAI({ apiKey, httpOptions: { timeout: REQUEST_TIMEOUT_MS } });
  return client;
}

function validFiles(files: AqylbekFile[]): boolean {
  if (files.length > MAX_FILES) return false;
  let total = 0;
  for (const file of files) {
    if (!file || typeof file.mimeType !== "string" || typeof file.data !== "string") return false;
    if (!ALLOWED_FILE_TYPES.test(file.mimeType) || file.data.startsWith("data:")) return false;
    total += file.data.length;
  }
  return total <= MAX_TOTAL_BASE64_CHARS;
}

/**
 * Builds the file parts for the request. Returns the names of files uploaded to the
 * Gemini Files API so the caller can delete them when the call is over.
 */
async function prepareFileParts(ai: GoogleGenAI, files: AqylbekFile[], uploaded: string[]): Promise<Part[]> {
  const totalBase64 = files.reduce((sum, f) => sum + f.data.length, 0);
  if (totalBase64 <= MAX_INLINE_BASE64_CHARS) {
    return files.map((file) => ({ inlineData: { mimeType: file.mimeType, data: file.data } }));
  }

  const parts: Part[] = [];
  for (const file of files) {
    const blob = new Blob([Buffer.from(file.data, "base64")], { type: file.mimeType });
    let remote = await ai.files.upload({ file: blob, config: { mimeType: file.mimeType } });
    if (remote.name) uploaded.push(remote.name);

    // PDFs/images are usually ACTIVE right away; wait briefly if Google is still processing.
    const deadline = Date.now() + FILE_ACTIVE_TIMEOUT_MS;
    while (String(remote.state) === "PROCESSING" && remote.name && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      remote = await ai.files.get({ name: remote.name });
    }
    if (String(remote.state) !== "ACTIVE" || !remote.uri) throw new Error("Gemini file not ready");
    parts.push({ fileData: { fileUri: remote.uri, mimeType: remote.mimeType ?? file.mimeType } });
  }
  return parts;
}

async function deleteUploadedFiles(ai: GoogleGenAI, names: string[]) {
  await Promise.all(
    names.map((name) =>
      ai.files.delete({ name }).catch((error: Error) => console.error("Aqylbek: Gemini file not deleted", error.message)),
    ),
  );
}

type LogStatus = "ok" | "busy" | "invalid_response" | "blocked" | "error" | "not_configured" | "invalid_task";

/** One ai_runs row per call. Metadata only: never the task, files or response. */
async function logRun(entry: {
  tutorId: string;
  mode: AqylbekMode;
  model: string | null;
  status: LogStatus;
  attempts: number;
  inputTokens: number;
  outputTokens: number;
  startedAt: number;
}) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("ai_runs").insert({
      tutor_id: entry.tutorId,
      mode: entry.mode,
      model: entry.model,
      status: entry.status,
      attempts: entry.attempts,
      input_tokens: entry.inputTokens,
      output_tokens: entry.outputTokens,
      duration_ms: Date.now() - entry.startedAt,
    });
    if (error) console.error("Aqylbek: ai_runs insert failed", error.code, error.message);
  } catch (error) {
    // Logging must never break the actual feature.
    console.error("Aqylbek: ai_runs insert threw", (error as Error).message);
  }
}

export async function callAqylbek<M extends AqylbekMode>(
  task: AqylbekTask<M>,
  files: AqylbekFile[] = [],
): Promise<AqylbekResult<M>> {
  const startedAt = Date.now();
  const user = await getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  if (!task || typeof task !== "object" || !isAqylbekMode(task.mode)) {
    return { ok: false, error: "invalidTask" };
  }
  const mode = task.mode;
  const model = process.env.GEMINI_MODEL?.trim() || null;
  const base = { tutorId: user.id, mode, model, startedAt, attempts: 0, inputTokens: 0, outputTokens: 0 };

  if (!validFiles(files)) {
    await logRun({ ...base, status: "invalid_task" });
    return { ok: false, error: "invalidTask" };
  }

  const ai = getClient();
  const systemPrompt = await loadSystemPrompt();
  if (!ai || !model || !systemPrompt) {
    console.error("Aqylbek: not configured", {
      apiKey: !!process.env.GEMINI_API_KEY,
      model: !!model,
      prompt: !!systemPrompt,
    });
    await logRun({ ...base, status: "not_configured" });
    return { ok: false, error: "notConfigured" };
  }

  const uploaded: string[] = [];
  let fileParts: Part[];
  try {
    fileParts = await prepareFileParts(ai, files, uploaded);
  } catch (error) {
    await deleteUploadedFiles(ai, uploaded);
    const busy = isBusyError(error);
    console.error("Aqylbek: file upload failed", busy ? "busy" : (error as Error).message);
    await logRun({ ...base, status: busy ? "busy" : "error" });
    return { ok: false, error: busy ? "busy" : "failed" };
  }
  const parts: Part[] = [{ text: JSON.stringify(task) }, ...fileParts];

  const generate = async (): Promise<GenerateResult> => {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
      },
    });
    const usage = response.usageMetadata;
    const finishReason = String(response.candidates?.[0]?.finishReason ?? "");
    return {
      text: response.text,
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
      blocked: !!response.promptFeedback?.blockReason || BLOCKED_FINISH_REASONS.has(finishReason),
    };
  };

  let outcome: RunOutcome<M>;
  try {
    outcome = await runAqylbek(mode, generate);
  } finally {
    await deleteUploadedFiles(ai, uploaded); // never leave student files on Google's side
  }
  await logRun({
    ...base,
    status: outcome.status,
    attempts: outcome.attempts,
    inputTokens: outcome.inputTokens,
    outputTokens: outcome.outputTokens,
  });

  if (outcome.status === "ok") return { ok: true, data: outcome.data };
  if (outcome.detail) console.warn(`Aqylbek ${mode}: ${outcome.status} (${outcome.detail})`);

  const errorByStatus = {
    busy: "busy",
    invalid_response: "invalidResponse",
    blocked: "blocked",
    error: "failed",
  } as const satisfies Record<Exclude<RunStatus, "ok">, AqylbekErrorCode>;
  return { ok: false, error: errorByStatus[outcome.status] };
}

/** Localized message for an error, e.g. "Aqylbek is busy, try again in a minute" in kk or ru. */
export async function aqylbekErrorMessage(code: AqylbekErrorCode, locale?: Locale): Promise<string> {
  const t = locale
    ? await getTranslations({ locale, namespace: "aqylbek.errors" })
    : await getTranslations("aqylbek.errors");
  return t(code);
}
