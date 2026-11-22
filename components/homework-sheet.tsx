import { useTranslations } from "next-intl";
import { optionLetter, type StudentSheet, type TeacherKey } from "@/lib/homework";
import { cn } from "@/lib/utils";

/**
 * The student sheet: prompts and options only. It receives ONLY a StudentSheet, so the
 * teacher key can't leak into it. Used on screen and on the A4 print page.
 */
export function HomeworkSheet({ sheet, variant }: { sheet: StudentSheet; variant: "screen" | "print" }) {
  const t = useTranslations("homework.sheet");
  const tTypes = useTranslations("homework.itemTypes");
  const print = variant === "print";

  return (
    <div className="grid gap-5">
      {sheet.instructions && <p className="whitespace-pre-line">{sheet.instructions}</p>}
      <ol className="grid gap-5">
        {sheet.items.map((item, index) => (
          <li key={item.id} className="print-avoid-break grid gap-2">
            <div className="flex gap-2">
              <span className="font-semibold tabular-nums">{index + 1}.</span>
              <div className="grid flex-1 gap-2">
                {!print && (
                  <span className="w-fit rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {tTypes(item.type)}
                  </span>
                )}
                <p className="whitespace-pre-line">{item.prompt}</p>

                {item.type === "multiple_choice" && (
                  <ul className="grid gap-1 pl-1">
                    {item.options.map((option, i) => (
                      <li key={i} className="flex gap-2">
                        <span className={cn("font-medium", print && "inline-block size-5 rounded-full border text-center text-xs leading-5")}>
                          {optionLetter(i)}
                        </span>
                        <span>{option}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {print && item.type === "short_answer" && <Lines count={2} />}
                {print && item.type === "essay_prompt" && <Lines count={14} />}
                {print && item.type === "math_problem" && (
                  <div className="h-40 rounded border border-dashed border-neutral-400" aria-label={t("workingSpace")} />
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Lines({ count }: { count: number }) {
  return (
    <div className="grid" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-8 border-b border-neutral-400" />
      ))}
    </div>
  );
}

/** Tutor-only view of answers and explanations, numbered like the sheet. */
export function TeacherKeyView({ sheet, teacherKey }: { sheet: StudentSheet; teacherKey: TeacherKey }) {
  const t = useTranslations("homework.key");
  const answers = new Map(teacherKey.items.map((k) => [k.id, k]));

  return (
    <ol className="grid gap-4">
      {sheet.items.map((item, index) => {
        const key = answers.get(item.id);
        return (
          <li key={item.id} className="grid gap-1 rounded-lg border bg-background p-3">
            <div className="flex gap-2">
              <span className="font-semibold tabular-nums">{index + 1}.</span>
              <p className="line-clamp-2 text-sm text-muted-foreground">{item.prompt}</p>
            </div>
            <div className="grid gap-1 pl-6">
              <p>
                <span className="text-sm font-medium">{t("answer")}: </span>
                {key?.answer ? (
                  <span className="whitespace-pre-line">{key.answer}</span>
                ) : (
                  <span className="text-sm text-muted-foreground italic">{t("noAnswer")}</span>
                )}
              </p>
              {key?.explanation && (
                <p className="text-sm whitespace-pre-line text-muted-foreground">{key.explanation}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
