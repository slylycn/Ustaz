"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { FileUp, Loader2, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isRedirectError } from "@/lib/redirect-error";
import { generateHomework, type GenerateField, type GenerateState } from "@/lib/actions/homework";
import { EXAMS, type Exam } from "@/lib/constants";
import { HOMEWORK_ITEM_TYPES, HOMEWORK_LIMITS, HOMEWORK_SOURCE_TYPES, type HomeworkItemType } from "@/lib/homework";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, describedBy } from "@/components/form-field";

type Props = {
  tutorId: string;
  defaultExam: Exam;
  students: { id: string; full_name: string }[];
  defaultStudentId: string;
  cancelHref: string;
};

const ACCEPT = Object.keys(HOMEWORK_SOURCE_TYPES).map((ext) => `.${ext}`).join(",");
const DEFAULT_TYPES: HomeworkItemType[] = ["multiple_choice", "gap_fill", "short_answer"];

function extOf(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!(ext in HOMEWORK_SOURCE_TYPES)) return null;
  return ext === "jpeg" ? "jpg" : ext;
}

export function HomeworkForm({ tutorId, defaultExam, students, defaultStudentId, cancelHref }: Props) {
  const t = useTranslations("homework.new");
  const tCommon = useTranslations("common");
  const tExams = useTranslations("exams");
  const tTypes = useTranslations("homework.itemTypes");

  const [topic, setTopic] = useState("");
  const [exam, setExam] = useState<Exam>(defaultExam);
  const [level, setLevel] = useState("");
  const [itemCount, setItemCount] = useState("10");
  const [itemTypes, setItemTypes] = useState<HomeworkItemType[]>(DEFAULT_TYPES);
  const [studentId, setStudentId] = useState(defaultStudentId);
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<GenerateState & { clientError?: "uploadFailed" | "fileInvalid" | "fileTooLarge" | "tooManyFiles" }>({});
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const errors = state.fieldErrors ?? {};
  const err = (field: GenerateField) => {
    const key = errors[field];
    return key ? t(`errors.${key}`) : undefined;
  };

  function addFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list);
    if (files.length + picked.length > HOMEWORK_LIMITS.sourceFiles) setState({ clientError: "tooManyFiles" });
    else if (picked.some((f) => !extOf(f))) setState({ clientError: "fileInvalid" });
    else if (picked.some((f) => f.size > HOMEWORK_LIMITS.sourceFileBytes)) setState({ clientError: "fileTooLarge" });
    else {
      setState({});
      setFiles((current) => [...current, ...picked]);
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      setState({});
      const id = crypto.randomUUID();
      const formData = new FormData();
      formData.set("id", id);
      formData.set("topic", topic);
      formData.set("exam", exam);
      formData.set("level", level);
      formData.set("itemCount", itemCount);
      itemTypes.forEach((type) => formData.append("itemTypes", type));
      formData.set("studentId", studentId);

      // Upload sources straight to the tutor's private folder (Storage RLS checks the folder).
      const storage = createClient().storage.from("homework");
      for (const [i, file] of files.entries()) {
        const ext = extOf(file)!;
        const path = `${tutorId}/${id}/source-${i + 1}.${ext}`;
        const { error } = await storage.upload(path, file, {
          contentType: HOMEWORK_SOURCE_TYPES[ext as keyof typeof HOMEWORK_SOURCE_TYPES],
          upsert: false,
        });
        if (error) {
          setState({ clientError: "uploadFailed" });
          return;
        }
        formData.append("sourcePaths", path);
      }

      // Redirects to the new homework on success; otherwise returns errors.
      try {
        setState(await generateHomework(formData));
      } catch (error) {
        if (isRedirectError(error)) throw error; // let Next navigate
        setState({ message: tCommon("unexpectedError") });
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6" noValidate>
      <Field id="topic" label={t("topicLabel")} hint={t("topicHint")} error={err("topic")}>
        <Textarea
          id="topic"
          rows={2}
          maxLength={HOMEWORK_LIMITS.topic}
          placeholder={t("topicPlaceholder")}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          aria-invalid={!!errors.topic || undefined}
          aria-describedby={describedBy("topic", err("topic"), t("topicHint"))}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="exam" label={t("examLabel")} error={err("exam")}>
          <NativeSelect id="exam" value={exam} onChange={(e) => setExam(e.target.value as Exam)}>
            {EXAMS.map((x) => (
              <option key={x} value={x}>
                {tExams(x)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="level" label={`${t("levelLabel")} ${tCommon("optional")}`} error={err("level")}>
          <Input
            id="level"
            maxLength={HOMEWORK_LIMITS.level}
            placeholder={t("levelPlaceholder")}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            aria-invalid={!!errors.level || undefined}
          />
        </Field>
        <Field id="itemCount" label={t("itemCountLabel")} error={err("itemCount")}>
          <Input
            id="itemCount"
            type="number"
            min={1}
            max={HOMEWORK_LIMITS.items}
            inputMode="numeric"
            value={itemCount}
            onChange={(e) => setItemCount(e.target.value)}
            aria-invalid={!!errors.itemCount || undefined}
          />
        </Field>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium">{t("itemTypesLabel")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {HOMEWORK_ITEM_TYPES.map((type) => {
            const checked = itemTypes.includes(type);
            return (
              <label
                key={type}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border bg-background p-3 text-sm font-medium transition-colors hover:bg-accent",
                  checked && "border-primary bg-primary/5 hover:bg-primary/10",
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) =>
                    setItemTypes((list) => (v === true ? [...list, type] : list.filter((x) => x !== type)))
                  }
                />
                {tTypes(type)}
              </label>
            );
          })}
        </div>
        <FieldError message={err("itemTypes")} />
      </fieldset>

      <Field id="studentId" label={`${t("studentLabel")} ${tCommon("optional")}`} error={err("studentId")}>
        <NativeSelect id="studentId" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">{t("noStudent")}</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <div className="grid gap-2">
        <span className="text-sm font-medium">
          {t("filesLabel")} {tCommon("optional")}
        </span>
        <input
          ref={fileInput}
          id="sources"
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={(e) => addFiles(e.target.files)}
        />
        {files.length > 0 && (
          <ul className="grid gap-2">
            {files.map((file, i) => (
              <li key={`${file.name}-${i}`} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                <FileUp className="size-4 text-primary" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
                <span className="text-muted-foreground">{t("fileSize", { mb: (file.size / 1024 / 1024).toFixed(1) })}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("removeFile")}
                  onClick={() => setFiles((list) => list.filter((_, j) => j !== i))}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {files.length < HOMEWORK_LIMITS.sourceFiles && (
          <label
            htmlFor="sources"
            className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed bg-background px-3 py-2 text-sm transition-colors hover:bg-accent"
          >
            <FileUp className="size-4 text-muted-foreground" aria-hidden />
            {t("addFiles")}
          </label>
        )}
        <p className="text-xs text-muted-foreground">{t("filesHint")}</p>
        <FieldError message={err("files") ?? (state.clientError && t(`errors.${state.clientError}`))} />
      </div>

      {state.message && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
          {pending ? t("generating") : t("submit")}
        </Button>
        <Button asChild variant="outline">
          <Link href={cancelHref}>{tCommon("cancel")}</Link>
        </Button>
        {pending && <span className="text-sm text-muted-foreground">{t("wait")}</span>}
      </div>
    </form>
  );
}
