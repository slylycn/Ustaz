/**
 * Homework shapes and checks, shared by server actions and the browser editor.
 *
 * Two separate documents per homework:
 *   student_sheet  { instructions, items: [{ id, type, prompt, options }] }  ← safe to print/share
 *   teacher_key    { items: [{ id, answer, explanation }] }                  ← tutor only
 * Items are matched by id ("i1", "i2", …, renumbered on every save).
 */
import type { AqylbekOutput } from "@/lib/aqylbek-schemas";
import { HOMEWORK_ITEM_TYPES, type HomeworkItemType } from "@/lib/homework-types";

export { HOMEWORK_ITEM_TYPES, type HomeworkItemType };

export type SheetItem = { id: string; type: HomeworkItemType; prompt: string; options: string[] };
export type StudentSheet = { instructions: string; items: SheetItem[] };
export type KeyItem = { id: string; answer: string; explanation: string };
export type TeacherKey = { items: KeyItem[] };

/** One row in the editor: the student part and the key part side by side. */
export type EditorItem = {
  type: HomeworkItemType;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
};

export const HOMEWORK_LIMITS = {
  topic: 300,
  title: 200,
  level: 50,
  instructions: 3000,
  prompt: 3000,
  option: 500,
  options: 8,
  answer: 3000,
  explanation: 3000,
  items: 30,
  sourceFiles: 3,
  sourceFileBytes: 10 * 1024 * 1024,
} as const;

/** Accepted source files for homework generation: extension → MIME type. */
export const HOMEWORK_SOURCE_TYPES = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
} as const;
export type HomeworkSourceMime = (typeof HOMEWORK_SOURCE_TYPES)[keyof typeof HOMEWORK_SOURCE_TYPES];

export function isHomeworkItemType(value: unknown): value is HomeworkItemType {
  return typeof value === "string" && (HOMEWORK_ITEM_TYPES as readonly string[]).includes(value);
}

const clip = (value: string, max: number) => value.trim().slice(0, max);

/** Only multiple choice keeps options; everything else has none. */
function cleanOptions(type: HomeworkItemType, options: string[]): string[] {
  if (type !== "multiple_choice") return [];
  return options.map((o) => clip(o, HOMEWORK_LIMITS.option)).filter(Boolean).slice(0, HOMEWORK_LIMITS.options);
}

/** Splits editor rows into the two documents, numbering items i1, i2, … */
export function splitItems(instructions: string, items: EditorItem[]): { sheet: StudentSheet; key: TeacherKey } {
  return {
    sheet: {
      instructions,
      items: items.map((item, i) => ({ id: `i${i + 1}`, type: item.type, prompt: item.prompt, options: item.options })),
    },
    key: {
      items: items.map((item, i) => ({ id: `i${i + 1}`, answer: item.answer, explanation: item.explanation })),
    },
  };
}

/** Joins the two documents back into editor rows (key matched by item id). */
export function joinItems(sheet: StudentSheet, key: TeacherKey): EditorItem[] {
  const answers = new Map(key.items.map((k) => [k.id, k]));
  return sheet.items.map((item) => ({
    type: item.type,
    prompt: item.prompt,
    options: item.options,
    answer: answers.get(item.id)?.answer ?? "",
    explanation: answers.get(item.id)?.explanation ?? "",
  }));
}

/** Aqylbek's homework → title + sheet + key. Answers only ever go to the key. */
export function fromAi(ai: AqylbekOutput<"homework">): { title: string; sheet: StudentSheet; key: TeacherKey } {
  const items: EditorItem[] = ai.items.slice(0, HOMEWORK_LIMITS.items).map((item) => {
    const options = cleanOptions(item.type, item.options);
    return {
      // A "multiple choice" item without at least 2 options can't be answered; treat it as short answer.
      type: item.type === "multiple_choice" && options.length < 2 ? "short_answer" : item.type,
      prompt: clip(item.prompt, HOMEWORK_LIMITS.prompt),
      options: options.length >= 2 ? options : [],
      answer: clip(item.answer, HOMEWORK_LIMITS.answer),
      explanation: clip(item.explanation, HOMEWORK_LIMITS.explanation),
    };
  });
  return {
    title: clip(ai.title, HOMEWORK_LIMITS.title),
    ...splitItems(clip(ai.instructions, HOMEWORK_LIMITS.instructions), items),
  };
}

export type HomeworkEditError = "titleRequired" | "itemsRequired" | "promptRequired" | "optionsRequired" | "tooLong" | "invalid";

/** Validates the editor's JSON: { title, instructions, items: EditorItem[] }. */
export function parseHomeworkEdit(
  raw: string,
): { ok: true; title: string; sheet: StudentSheet; key: TeacherKey } | { ok: false; error: HomeworkEditError } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "invalid" };
  }
  if (!data || typeof data !== "object") return { ok: false, error: "invalid" };
  const input = data as Record<string, unknown>;

  if (typeof input.title !== "string" || typeof input.instructions !== "string" || !Array.isArray(input.items)) {
    return { ok: false, error: "invalid" };
  }
  const title = input.title.trim();
  const instructions = input.instructions.trim();
  if (!title) return { ok: false, error: "titleRequired" };
  if (title.length > HOMEWORK_LIMITS.title || instructions.length > HOMEWORK_LIMITS.instructions) {
    return { ok: false, error: "tooLong" };
  }
  if (input.items.length === 0) return { ok: false, error: "itemsRequired" };
  if (input.items.length > HOMEWORK_LIMITS.items) return { ok: false, error: "tooLong" };

  const items: EditorItem[] = [];
  for (const raw of input.items) {
    const item = raw as Record<string, unknown> | null;
    if (!item || typeof item !== "object" || !isHomeworkItemType(item.type)) return { ok: false, error: "invalid" };
    const strings = [item.prompt, item.answer, item.explanation];
    if (!strings.every((v) => typeof v === "string")) return { ok: false, error: "invalid" };
    if (!Array.isArray(item.options) || !item.options.every((o) => typeof o === "string")) return { ok: false, error: "invalid" };

    const prompt = (item.prompt as string).trim();
    const answer = (item.answer as string).trim();
    const explanation = (item.explanation as string).trim();
    const rawOptions = (item.options as string[]).map((o) => o.trim()).filter(Boolean);
    if (!prompt) return { ok: false, error: "promptRequired" };
    if (
      prompt.length > HOMEWORK_LIMITS.prompt ||
      answer.length > HOMEWORK_LIMITS.answer ||
      explanation.length > HOMEWORK_LIMITS.explanation ||
      rawOptions.length > HOMEWORK_LIMITS.options ||
      rawOptions.some((o) => o.length > HOMEWORK_LIMITS.option)
    ) {
      return { ok: false, error: "tooLong" };
    }
    if (item.type === "multiple_choice" && rawOptions.length < 2) return { ok: false, error: "optionsRequired" };

    items.push({ type: item.type, prompt, options: cleanOptions(item.type, rawOptions), answer, explanation });
  }

  return { ok: true, title, ...splitItems(instructions, items) };
}

/** "A", "B", … for multiple-choice options. */
export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}
