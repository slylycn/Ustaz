import type { SharedReport } from "@/lib/supabase/public";

type Grade = SharedReport["grades"][number];

type Labels = {
  /** e.g. "Show as a table" */
  table: string;
  date: string;
  score: string;
  /** Formats a "YYYY-MM-DD" date for axis labels and tooltips. */
  formatDate: (date: string) => string;
  /** Accessible chart description, e.g. "IELTS Writing Task 2: 5 grades from 6 to 7". */
  describe: (rubric: string, count: number, first: number, last: number) => string;
};

const W = 600;
const H = 220;
const PAD = { top: 18, right: 40, bottom: 30, left: 36 };

function ticksFor(min: number, max: number): number[] {
  const span = max - min;
  const step = span <= 10 ? Math.max(1, Math.ceil(span / 4)) : Math.ceil(span / 4 / 5) * 5;
  const ticks: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  if (ticks[ticks.length - 1] !== max) ticks.push(max);
  return ticks;
}

/**
 * Approved overall grades over time, one small chart per rubric (different rubrics have
 * different scales, so they never share an axis). Single series per chart: the title names
 * it, so there is no legend. Hover a point for its date and score; a table view is included.
 */
export function GradesChart({ grades, labels }: { grades: Grade[]; labels: Labels }) {
  const groups = new Map<string, Grade[]>();
  for (const g of grades) groups.set(g.rubric || "—", [...(groups.get(g.rubric || "—") ?? []), g]);

  return (
    <div className="grid gap-6">
      {[...groups.entries()].map(([rubric, items]) => {
        const min = items[0].scale_min ?? Math.min(...items.map((g) => g.overall));
        const max = items[0].scale_max ?? Math.max(...items.map((g) => g.overall));
        const times = items.map((g) => Date.parse(`${g.date}T12:00:00Z`));
        const t0 = Math.min(...times);
        const t1 = Math.max(...times);
        const innerW = W - PAD.left - PAD.right;
        const innerH = H - PAD.top - PAD.bottom;
        const x = (t: number) => (t1 === t0 ? PAD.left + innerW / 2 : PAD.left + ((t - t0) / (t1 - t0)) * innerW);
        const y = (v: number) => PAD.top + (1 - (v - min) / (max - min || 1)) * innerH;
        const points = items.map((g, i) => ({ g, cx: x(times[i]), cy: y(g.overall) }));
        const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(" ");
        const last = points[points.length - 1];

        return (
          <figure key={rubric} className="grid gap-2">
            <figcaption className="text-sm font-medium">{rubric}</figcaption>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-auto w-full"
              role="img"
              aria-label={labels.describe(rubric, items.length, items[0].overall, last.g.overall)}
            >
              {/* Recessive grid + y labels */}
              {ticksFor(min, max).map((tick) => (
                <g key={tick}>
                  <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-border" strokeWidth={1} />
                  <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px]">
                    {tick}
                  </text>
                </g>
              ))}
              {/* x labels: first and last date only */}
              <text x={points[0].cx} y={H - 8} textAnchor={points.length > 1 ? "start" : "middle"} className="fill-muted-foreground text-[11px]">
                {labels.formatDate(items[0].date)}
              </text>
              {points.length > 1 && (
                <text x={last.cx} y={H - 8} textAnchor="end" className="fill-muted-foreground text-[11px]">
                  {labels.formatDate(last.g.date)}
                </text>
              )}

              {points.length > 1 && (
                <path d={path} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              )}
              {points.map((p, i) => (
                <g key={i}>
                  {/* 8px marker with a 2px surface ring */}
                  <circle cx={p.cx} cy={p.cy} r={4} className="fill-primary stroke-card" strokeWidth={2} />
                  {/* Bigger invisible hit target; native tooltip on hover/long-press */}
                  <circle cx={p.cx} cy={p.cy} r={14} fill="transparent">
                    <title>{`${labels.formatDate(p.g.date)}: ${p.g.overall}`}</title>
                  </circle>
                </g>
              ))}
              {/* Direct label on the latest grade only */}
              <text x={last.cx + 10} y={last.cy} dy="0.32em" className="fill-foreground text-[13px] font-semibold">
                {last.g.overall}
              </text>
            </svg>

            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">{labels.table}</summary>
              <table className="mt-2 w-full max-w-sm text-left">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-1 font-medium">{labels.date}</th>
                    <th scope="col" className="py-1 font-medium">{labels.score}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((g, i) => (
                    <tr key={i}>
                      <td className="py-1">{labels.formatDate(g.date)}</td>
                      <td className="py-1 font-medium tabular-nums">{g.overall}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </figure>
        );
      })}
    </div>
  );
}
