// Kept in its own tiny module so both the zod schemas and browser code can import it
// without pulling zod into the browser bundle. Must match the SQL check on homework.item_types.
export const HOMEWORK_ITEM_TYPES = [
  "multiple_choice",
  "gap_fill",
  "short_answer",
  "essay_prompt",
  "math_problem",
] as const;
export type HomeworkItemType = (typeof HOMEWORK_ITEM_TYPES)[number];
