/**
 * Aqylbek's retry and validation loop, with no SDK or Next.js imports so it can be
 * unit-tested with a fake `generate` function. lib/aqylbek.ts wires it to Gemini.
 */
import { AQYLBEK_SCHEMAS, type AqylbekMode, type AqylbekOutput } from "@/lib/aqylbek-schemas";
import { normalizeOutput } from "@/lib/aqylbek-normalize";

export type GenerateResult = {
  text: string | undefined;
  inputTokens: number;
  outputTokens: number;
  /** True when Gemini refused (safety / prohibited content): retrying won't help. */
  blocked: boolean;
};

export type RunStatus = "ok" | "busy" | "invalid_response" | "blocked" | "error";

export type RunOutcome<M extends AqylbekMode> =
  | { status: "ok"; data: AqylbekOutput<M>; attempts: number; inputTokens: number; outputTokens: number }
  | {
      status: Exclude<RunStatus, "ok">;
      attempts: number;
      inputTokens: number;
      outputTokens: number;
      /** Safe for logs: issue paths/codes only, never response or student text. */
      detail?: string;
    };

export type RunOptions = {
  /** Retries after HTTP 429/503 (so up to 1 + this many requests). */
  maxBusyRetries?: number;
  /** Retries after a response that isn't valid JSON or fails the schema. */
  maxInvalidRetries?: number;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** HTTP 429 (rate limit / quota) or 503 (model overloaded): both mean "busy, try later". */
export function isBusyError(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  if (status === 429 || status === 503) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /\b429\b|RESOURCE_EXHAUSTED|\b503\b|UNAVAILABLE|overloaded/i.test(message);
}

/**
 * How long to wait before busy-retry number `retry` (1-based).
 * Uses Gemini's RetryInfo ("retryDelay": "17s") when present, capped so a request can't hang.
 */
export function busyDelayMs(error: unknown, retry: number): number {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const match = message.match(/retryDelay"?\s*[:=]\s*"?(\d+(?:\.\d+)?)s/i);
  const fallback = retry === 1 ? 2_000 : 5_000;
  const suggested = match ? Math.ceil(Number(match[1]) * 1000) : fallback;
  return Math.min(Math.max(suggested, 1_000), 15_000);
}

/** JSON.parse that tolerates a ```json fence around the payload. */
export function parseJson(text: string | undefined): unknown {
  if (!text) return undefined;
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    return undefined;
  }
}

export function validateOutput<M extends AqylbekMode>(
  mode: M,
  text: string | undefined,
): { ok: true; data: AqylbekOutput<M> } | { ok: false; detail: string } {
  const json = parseJson(text);
  if (json === undefined) return { ok: false, detail: "not JSON" };
  // The prompt's JSON shapes differ slightly from the app's; translate before validating.
  const result = AQYLBEK_SCHEMAS[mode].safeParse(normalizeOutput(mode, json));
  if (result.success) return { ok: true, data: result.data as AqylbekOutput<M> };
  const issues = result.error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.code}`)
    .join("; ");
  return { ok: false, detail: `schema: ${issues}` };
}

export async function runAqylbek<M extends AqylbekMode>(
  mode: M,
  generate: () => Promise<GenerateResult>,
  options: RunOptions = {},
): Promise<RunOutcome<M>> {
  const { maxBusyRetries = 2, maxInvalidRetries = 1, sleep = defaultSleep } = options;
  let attempts = 0;
  let busyRetries = 0;
  let invalidRetries = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  const totals = () => ({ attempts, inputTokens, outputTokens });

  for (;;) {
    attempts++;
    let result: GenerateResult;
    try {
      result = await generate();
    } catch (error) {
      if (isBusyError(error)) {
        if (busyRetries < maxBusyRetries) {
          busyRetries++;
          await sleep(busyDelayMs(error, busyRetries));
          continue;
        }
        return { status: "busy", ...totals() };
      }
      const status = (error as { status?: unknown } | null)?.status;
      return { status: "error", ...totals(), detail: typeof status === "number" ? `http ${status}` : "request failed" };
    }

    inputTokens += result.inputTokens;
    outputTokens += result.outputTokens;

    if (result.blocked) return { status: "blocked", ...totals() };

    const checked = validateOutput(mode, result.text);
    if (checked.ok) return { status: "ok", data: checked.data, ...totals() };

    if (invalidRetries < maxInvalidRetries) {
      invalidRetries++;
      continue;
    }
    return { status: "invalid_response", ...totals(), detail: checked.detail };
  }
}
