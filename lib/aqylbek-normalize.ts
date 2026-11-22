/**
 * Translates Aqylbek's replies, written in the shapes defined in lib/prompts/aqylbek-system.md,
 * into the shapes the app validates in lib/aqylbek-schemas.ts. Runs before validation.
 * Pure functions, no SDK imports, so it can be tested on its own.
 *
 * Differences it bridges:
 * - every mode: the prompt's schemas have no "mode" field; the app's do. → added here.
 * - grade: "evidence" → "evidence_quotes"; "next_step" is appended to the comment.
 * - homework: {student_sheet: {instructions, items[{n, type, prompt, options}]}, teacher_key[{n, answer, explanation}]}
 *   → {title, instructions, items[{type, prompt, options, answer, explanation}]},
 *   and free-text item types ("gap fill", "Multiple choice") → the app's enum ("gap_fill", …).
 */
import { HOMEWORK_ITEM_TYPES, type HomeworkItemType } from "./homework-types";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

/** Maps any reasonable spelling of an item type to one of HOMEWORK_ITEM_TYPES. */
export function normalizeItemType(value: unknown): HomeworkItemType {
  const t = str(value).toLowerCase().trim().replace(/[\s-]+/g, "_");
  if ((HOMEWORK_ITEM_TYPES as readonly string[]).includes(t)) return t as HomeworkItemType;
  if (/choice|mcq|select/.test(t)) return "multiple_choice";
  if (/gap|fill|blank|cloze|complete/.test(t)) return "gap_fill";
  if (/essay|writing|composition/.test(t)) return "essay_prompt";
  if (/math|problem|calcul|equation/.test(t)) return "math_problem";
  return "short_answer";
}

function normalizeGrade(out: Obj) {
  if (!Array.isArray(out.criteria)) return;
  out.criteria = out.criteria.map((c) => {
    if (!isObj(c)) return c;
    const evidence = c.evidence_quotes ?? c.evidence;
    const comment = [str(c.comment).trim(), str(c.next_step).trim()].filter(Boolean).join("\n\n");
    return {
      ...c,
      evidence_quotes: Array.isArray(evidence) ? evidence.map(str).filter(Boolean) : [],
      comment,
    };
  });
}

function normalizeHomework(out: Obj) {
  const sheet = isObj(out.student_sheet) ? out.student_sheet : null;
  const key = Array.isArray(out.teacher_key) ? out.teacher_key.filter(isObj) : [];

  if (sheet && Array.isArray(sheet.items)) {
    if (!str(out.instructions)) out.instructions = str(sheet.instructions);
    out.items = sheet.items.filter(isObj).map((item, i) => {
      const n = item.n ?? i + 1;
      const answer = key.find((k) => String(k.n) === String(n)) ?? key[i] ?? {};
      return {
        type: item.type,
        prompt: str(item.prompt),
        options: Array.isArray(item.options) ? item.options.map(str) : [],
        answer: str(answer.answer),
        explanation: str(answer.explanation),
      };
    });
  }

  if (Array.isArray(out.items)) {
    out.items = out.items.map((item) =>
      isObj(item)
        ? { ...item, type: normalizeItemType(item.type), options: Array.isArray(item.options) ? item.options.map(str) : [] }
        : item,
    );
  }
}

export function normalizeOutput(mode: "grade" | "homework" | "parent_report", json: unknown): unknown {
  if (!isObj(json)) return json;
  const out: Obj = { ...json, mode };
  if (mode === "grade") normalizeGrade(out);
  if (mode === "homework") normalizeHomework(out);
  return out;
}
