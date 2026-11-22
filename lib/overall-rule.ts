/**
 * Turns a rubric's free-text overall_rule into something code can compute, e.g.
 *   "Mean of the 4 criteria, rounded to the nearest 0.5"
 *   "Среднее 4 критериев, округление до 0.5"
 *   "4 критерийдің орташасы, 0.5-ке дейін дөңгелектенеді"
 *   "Sum of all criteria"
 * When the rule can't be understood, it returns null: the tutor then sets the overall score.
 * The model's own overall number is never used.
 */

export type Rounding = { mode: "nearest" | "down" | "up"; step: number };

export type OverallRule = {
  kind: "mean" | "sum";
  /** null → mean snaps to the nearest scale step; sum is left as is. */
  rounding: Rounding | null;
};

const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;
// JavaScript's \w is ASCII-only, so Russian/Kazakh word endings need their own class.
const CYR = "[а-яёәғқңөұүһі]*";

function toNumber(text: string): number {
  return Number(text.replace(",", "."));
}

export function parseOverallRule(text: string | null | undefined): OverallRule | null {
  if (!text) return null;
  const s = text.toLowerCase().replace(/\s+/g, " ");

  const isMean = /\b(mean|average|avg)\b|средн|орташа/.test(s);
  const isSum = /\b(sum|total)\b|сумм|қосынды|жиынтық/.test(s);
  if (isMean === isSum) return null; // neither, or ambiguous

  const mentionsRounding = /round|округл|дөңгелект/.test(s);
  let rounding: Rounding | null = null;

  if (mentionsRounding) {
    const mode: Rounding["mode"] =
      /round(?:ed|ing|s)? down|\bfloor\b|вниз|в меньшую|төмен/.test(s)
        ? "down"
        : /round(?:ed|ing|s)? up|\bceil|вверх|в большую|жоғары/.test(s)
          ? "up"
          : "nearest";

    let step: number | null = null;
    if (/whole|integer|целого|целых|бүтін/.test(s)) step = 1;

    const patterns = [
      new RegExp(String.raw`round\w*(?: (?:down|up))?(?: to)?(?: the)?(?: nearest)? ${NUMBER}`),
      new RegExp(String.raw`округл${CYR}(?: (?:вниз|вверх))?(?: до)?(?: ближайш${CYR})? ${NUMBER}`),
      new RegExp(String.raw`${NUMBER} ?-? ?[а-яәғқңөұүһі]* дейін(?: \S+)? дөңгелект`),
      new RegExp(String.raw`дөңгелект${CYR} ${NUMBER}`),
    ];
    for (const pattern of patterns) {
      if (step !== null) break;
      const match = s.match(pattern);
      if (match) step = toNumber(match[1]);
    }

    if (step === null || !(step > 0)) return null; // "rounded" but to what? Let the tutor decide.
    rounding = { mode, step };
  }

  return { kind: isMean ? "mean" : "sum", rounding };
}

const EPS = 1e-9;
const tidy = (n: number) => Math.round(n * 1000) / 1000;

function applyRounding(value: number, rounding: Rounding): number {
  const units = value / rounding.step;
  const rounded =
    rounding.mode === "down"
      ? Math.floor(units + EPS)
      : rounding.mode === "up"
        ? Math.ceil(units - EPS)
        : Math.round(units + EPS); // halves round up: 6.25 → 6.5
  return tidy(rounded * rounding.step);
}

/**
 * Overall score from criterion scores. Returns null if any score is missing.
 * A mean is clamped to the scale and, without an explicit rounding, snapped to the scale step.
 */
export function computeOverall(
  rule: OverallRule,
  scores: (number | null)[],
  scale: { min: number; max: number; step: number },
): number | null {
  if (scores.length === 0 || scores.some((s) => s === null || !Number.isFinite(s))) return null;
  const values = scores as number[];
  const sum = values.reduce((a, b) => a + b, 0);

  if (rule.kind === "sum") {
    return rule.rounding ? applyRounding(sum, rule.rounding) : tidy(sum);
  }

  const mean = sum / values.length;
  const rounded = applyRounding(mean, rule.rounding ?? { mode: "nearest", step: scale.step });
  return Math.min(Math.max(rounded, scale.min), scale.max);
}
