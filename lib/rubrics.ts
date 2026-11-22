// Rubric helpers shared by the server (validation) and the browser (editor).

export const RUBRIC_LIMITS = {
  taskType: 100,
  name: 150,
  version: 50,
  overallRule: 500,
  url: 500,
  criterionName: 100,
  descriptor: 5000,
  criteria: 20,
  scalePoints: 1001,
  /** Raw JSON size of the criteria field. */
  criteriaJson: 200_000,
} as const;

export type RubricCriterion = {
  name: string;
  /** Score (as a string like "9" or "8.5") → descriptor text. Empty text = not filled in yet. */
  descriptors_by_score: Record<string, string>;
};

const EPSILON = 1e-9;

export function roundScore(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Canonical key for a score: 9 → "9", 8.50 → "8.5". */
export function scoreKey(n: number): string {
  return String(roundScore(n));
}

export function isValidScale(min: number, max: number, step: number): boolean {
  if (![min, max, step].every(Number.isFinite)) return false;
  if (step <= 0 || max <= min) return false;
  const steps = (max - min) / step;
  return Math.abs(steps - Math.round(steps)) < EPSILON && Math.round(steps) + 1 <= RUBRIC_LIMITS.scalePoints;
}

/** Every allowed score from min to max, ascending. [] if the scale is invalid. */
export function scalePoints(min: number, max: number, step: number): number[] {
  if (!isValidScale(min, max, step)) return [];
  const count = Math.round((max - min) / step) + 1;
  return Array.from({ length: count }, (_, i) => roundScore(min + i * step));
}

/** Scale points as canonical keys, ascending: ["0", "0.5", …, "9"]. */
export function scaleKeyList(min: number, max: number, step: number): string[] {
  return scalePoints(min, max, step).map(scoreKey);
}

/** Whole-number scores among the points (e.g. IELTS bands 0–9), or [] if there are too many. */
export function scorePointsForEditor(keys: string[]): string[] {
  const whole = keys.filter((k) => Number.isInteger(Number(k)));
  return whole.length <= 41 ? whole : [];
}

export function isOnScale(score: number, min: number, max: number, step: number): boolean {
  if (!Number.isFinite(score) || !isValidScale(min, max, step)) return false;
  if (score < min - EPSILON || score > max + EPSILON) return false;
  const k = (score - min) / step;
  return Math.abs(k - Math.round(k)) < EPSILON;
}

/** Highest score first, the way band descriptor tables are usually printed. */
export function sortScoresDesc(keys: string[]): string[] {
  return [...keys].sort((a, b) => Number(b) - Number(a));
}

export function countFilledDescriptors(criteria: RubricCriterion[]): number {
  return criteria.reduce(
    (sum, c) => sum + Object.values(c.descriptors_by_score).filter((d) => d.trim() !== "").length,
    0,
  );
}

/**
 * Parses and checks criteria JSON against a scale. Returns normalized criteria
 * (trimmed names, canonical score keys) or null when anything is off.
 */
export function parseCriteria(
  raw: string,
  scale: { min: number; max: number; step: number },
): RubricCriterion[] | null {
  if (raw.length > RUBRIC_LIMITS.criteriaJson) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(data) || data.length < 1 || data.length > RUBRIC_LIMITS.criteria) return null;

  const result: RubricCriterion[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") return null;
    const { name, descriptors_by_score } = item as Record<string, unknown>;
    if (typeof name !== "string") return null;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > RUBRIC_LIMITS.criterionName) return null;
    if (!descriptors_by_score || typeof descriptors_by_score !== "object" || Array.isArray(descriptors_by_score)) {
      return null;
    }

    const descriptors: Record<string, string> = {};
    for (const [key, value] of Object.entries(descriptors_by_score as Record<string, unknown>)) {
      const score = Number(key);
      if (key.trim() === "" || !isOnScale(score, scale.min, scale.max, scale.step)) return null;
      if (typeof value !== "string" || value.length > RUBRIC_LIMITS.descriptor) return null;
      const canonical = scoreKey(score);
      if (canonical in descriptors) return null; // "8.5" and "8.50" in the same criterion
      descriptors[canonical] = value.trim();
    }
    result.push({ name: trimmed, descriptors_by_score: descriptors });
  }
  return result;
}
