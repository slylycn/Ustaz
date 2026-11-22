"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, KeyRound, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { saveHomework, type HomeworkSaveState } from "@/lib/actions/homework";
import { HOMEWORK_ITEM_TYPES, HOMEWORK_LIMITS, optionLetter, type EditorItem, type HomeworkItemType } from "@/lib/homework";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/form-field";

type Props = {
  homeworkId: string;
  initial: { title: string; instructions: string; items: EditorItem[]; studentId: string; dueDate: string };
  students: { id: string; full_name: string }[];
  cancelHref: string;
};

type Row = EditorItem & { key: string };
let seq = 0;
const withKey = (item: EditorItem): Row => ({ ...item, key: `r${++seq}` });
const initialState: HomeworkSaveState = {};

/** Edits the student part and the teacher-key part of every item side by side. Drafts only. */
export function HomeworkEditor({ homeworkId, initial, students, cancelHref }: Props) {
  const t = useTranslations("homework.editor");
  const tCommon = useTranslations("common");
  const tTypes = useTranslations("homework.itemTypes");
  const [state, formAction, pending] = useActionState(saveHomework, initialState);

  const [title, setTitle] = useState(initial.title);
  const [instructions, setInstructions] = useState(initial.instructions);
  const [studentId, setStudentId] = useState(initial.studentId);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [rows, setRows] = useState<Row[]>(() => initial.items.map(withKey));

  const update = (key: string, patch: Partial<EditorItem>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (index: number, delta: number) =>
    setRows((list) => {
      const next = [...list];
      const [row] = next.splice(index, 1);
      next.splice(index + delta, 0, row);
      return next;
    });

  const content = JSON.stringify({
    title,
    instructions,
    items: rows.map(({ key: _key, ...item }) => item),
  });

  return (
    <form action={formAction} className="grid gap-6">
      <input type="hidden" name="id" value={homeworkId} />
      <input type="hidden" name="content" value={content} />
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="dueDate" value={dueDate} />

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <div className="grid gap-2">
          <Label htmlFor="title">{t("titleLabel")}</Label>
          <Input id="title" maxLength={HOMEWORK_LIMITS.title} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="studentSelect">{t("studentLabel")}</Label>
          <NativeSelect id="studentSelect" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">{t("noStudent")}</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dueDateInput">{`${t("dueDateLabel")} ${tCommon("optional")}`}</Label>
          <Input id="dueDateInput" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="instructions">{t("instructionsLabel")}</Label>
        <Textarea
          id="instructions"
          rows={2}
          maxLength={HOMEWORK_LIMITS.instructions}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>

      <ol className="grid gap-4">
        {rows.map((row, index) => {
          const id = `item${index}`;
          return (
            <li key={row.key} className="grid gap-4 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold tabular-nums">{index + 1}.</span>
                <NativeSelect
                  aria-label={t("typeLabel")}
                  value={row.type}
                  onChange={(e) => update(row.key, { type: e.target.value as HomeworkItemType })}
                  className="h-8 w-48"
                >
                  {HOMEWORK_ITEM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {tTypes(type)}
                    </option>
                  ))}
                </NativeSelect>
                <div className="ml-auto flex gap-1">
                  <Button type="button" variant="ghost" size="icon" aria-label={t("moveUp")} disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("moveDown")}
                    disabled={index === rows.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("removeItem")}
                    disabled={rows.length === 1}
                    onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Student part */}
                <div className="grid content-start gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-prompt`}>{t("promptLabel")}</Label>
                    <Textarea
                      id={`${id}-prompt`}
                      rows={3}
                      maxLength={HOMEWORK_LIMITS.prompt}
                      value={row.prompt}
                      onChange={(e) => update(row.key, { prompt: e.target.value })}
                    />
                  </div>
                  {row.type === "multiple_choice" && (
                    <div className="grid gap-2">
                      <span className="text-sm font-medium">{t("optionsLabel")}</span>
                      {row.options.map((option, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-5 text-sm font-medium">{optionLetter(i)}</span>
                          <Input
                            aria-label={t("optionLabel", { letter: optionLetter(i) })}
                            maxLength={HOMEWORK_LIMITS.option}
                            value={option}
                            onChange={(e) =>
                              update(row.key, { options: row.options.map((o, j) => (j === i ? e.target.value : o)) })
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t("removeOption")}
                            onClick={() => update(row.key, { options: row.options.filter((_, j) => j !== i) })}
                          >
                            <X aria-hidden />
                          </Button>
                        </div>
                      ))}
                      {row.options.length < HOMEWORK_LIMITS.options && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="justify-self-start"
                          onClick={() => update(row.key, { options: [...row.options, ""] })}
                        >
                          <Plus aria-hidden />
                          {t("addOption")}
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Teacher key part, visually separated */}
                <div className="grid content-start gap-3 rounded-lg border border-amber-300/60 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/5">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200">
                    <KeyRound className="size-3.5" aria-hidden />
                    {t("keyOnlyYou")}
                  </span>
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-answer`}>{t("answerLabel")}</Label>
                    <Textarea
                      id={`${id}-answer`}
                      rows={2}
                      maxLength={HOMEWORK_LIMITS.answer}
                      value={row.answer}
                      onChange={(e) => update(row.key, { answer: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-explanation`}>{t("explanationLabel")}</Label>
                    <Textarea
                      id={`${id}-explanation`}
                      rows={2}
                      maxLength={HOMEWORK_LIMITS.explanation}
                      value={row.explanation}
                      onChange={(e) => update(row.key, { explanation: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {rows.length < HOMEWORK_LIMITS.items && (
        <Button
          type="button"
          variant="outline"
          className="justify-self-start"
          onClick={() =>
            setRows((list) => [...list, withKey({ type: "short_answer", prompt: "", options: [], answer: "", explanation: "" })])
          }
        >
          <Plus aria-hidden />
          {t("addItem")}
        </Button>
      )}

      <FieldError message={state.error && t(`errors.${state.error}`)} />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          {pending ? tCommon("saving") : t("save")}
        </Button>
        <Button asChild variant="outline">
          <Link href={cancelHref}>{tCommon("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
