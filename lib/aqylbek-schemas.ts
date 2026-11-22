import { z } from "zod";
import { HOMEWORK_ITEM_TYPES } from "@/lib/homework-types";

/**
 * Response schemas for Aqylbek's three modes.
 *
 * The prompt (lib/prompts/aqylbek-system.md) uses slightly different JSON shapes; replies are
 * translated by lib/aqylbek-normalize.ts before being validated against these schemas.
 *
 * z.object() ignores unknown extra fields, so only missing or wrong-type fields fail validation.
 */

export const AQYLBEK_MODES = ["grade", "homework", "parent_report"] as const;
export type AqylbekMode = (typeof AQYLBEK_MODES)[number];

export function isAqylbekMode(value: unknown): value is AqylbekMode {
  return typeof value === "string" && (AQYLBEK_MODES as readonly string[]).includes(value);
}

const text = z.string().trim().min(1);

/**
 * grade: one entry per rubric criterion with evidence quotes from the student's work,
 * feedback addressed to the student, and flags for the tutor (e.g. off-topic, too short).
 * overall_score is accepted but IGNORED: the app computes the overall in code (lib/overall-rule.ts).
 */
export const gradeSchema = z.object({
  mode: z.literal("grade"),
  criteria: z
    .array(
      z.object({
        name: text,
        score: z.number(),
        evidence_quotes: z.array(z.string()).default([]),
        comment: z.string().default(""),
      }),
    )
    .min(1),
  student_feedback: z.string().default(""),
  flags: z.array(z.string()).default([]),
  overall_score: z.number().optional(),
});

/**
 * homework: a flat list of items, each with its answer. The app SPLITS this in code into a
 * student sheet (prompt + options) and a teacher key (answer + explanation), see lib/homework.ts,
 * so an answer can never end up on the printed sheet even if the model mixes them.
 */
export const homeworkSchema = z.object({
  mode: z.literal("homework"),
  title: text,
  instructions: z.string().default(""),
  items: z
    .array(
      z.object({
        type: z.enum(HOMEWORK_ITEM_TYPES),
        prompt: text,
        options: z.array(z.string()).default([]),
        answer: z.string().default(""),
        explanation: z.string().default(""),
      }),
    )
    .min(1),
});

/**
 * parent_report: either a message for the parent (status "ok"), or, when the week's data
 * isn't enough to write an honest report, status "needs_data" with what is missing.
 */
export const parentReportSchema = z
  .object({
    mode: z.literal("parent_report"),
    status: z.enum(["ok", "needs_data"]).default("ok"),
    message: z.string().default(""),
    missing: z.array(z.string()).default([]),
  })
  .refine((r) => (r.status === "ok" ? r.message.trim().length > 0 : r.missing.some((m) => m.trim())), {
    message: "ok needs a message; needs_data needs at least one missing item",
  });

export const AQYLBEK_SCHEMAS = {
  grade: gradeSchema,
  homework: homeworkSchema,
  parent_report: parentReportSchema,
} as const;

export type AqylbekOutput<M extends AqylbekMode> = z.infer<(typeof AQYLBEK_SCHEMAS)[M]>;
