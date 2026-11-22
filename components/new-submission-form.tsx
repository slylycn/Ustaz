"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { FileUp, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isRedirectError } from "@/lib/redirect-error";
import {
  createSubmission,
  type NewSubmissionErrorKey,
  type NewSubmissionField,
  type NewSubmissionState,
} from "@/lib/actions/submissions";
import {
  MAX_SUBMISSION_FILE_BYTES,
  SUBMISSION_FILE_TYPES,
  SUBMISSION_LIMITS,
  type SubmissionMime,
} from "@/lib/constants";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, FieldError, describedBy } from "@/components/form-field";

type ClientErrorKey = NewSubmissionErrorKey | "uploadFailed";
type State = {
  fieldErrors?: Partial<Record<NewSubmissionField, ClientErrorKey>>;
  formError?: ClientErrorKey;
};

type Props = {
  tutorId: string;
  students: { id: string; full_name: string }[];
  rubrics: { id: string; label: string }[];
  defaultStudentId: string;
  defaultRubricId: string;
  cancelHref: string;
};

const ACCEPT = Object.keys(SUBMISSION_FILE_TYPES).map((ext) => `.${ext}`).join(",");

function mimeFromName(name: string): SubmissionMime | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return (SUBMISSION_FILE_TYPES as Record<string, SubmissionMime>)[ext] ?? null;
}

function extFor(mime: SubmissionMime) {
  return mime === "image/jpeg" ? "jpg" : Object.entries(SUBMISSION_FILE_TYPES).find(([, m]) => m === mime)![0];
}

export function NewSubmissionForm({ tutorId, students, rubrics, defaultStudentId, defaultRubricId, cancelHref }: Props) {
  const t = useTranslations("submission.new");
  const tCommon = useTranslations("common");
  const [studentId, setStudentId] = useState(defaultStudentId);
  const [rubricId, setRubricId] = useState(defaultRubricId);
  const [taskPrompt, setTaskPrompt] = useState("");
  const [workType, setWorkType] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [state, setState] = useState<State>({});
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const errors = state.fieldErrors ?? {};
  const err = (field: NewSubmissionField) => {
    const key = errors[field];
    return key ? t(`errors.${key}`) : undefined;
  };

  function pickFile(picked: File | null) {
    setState((s) => ({ ...s, fieldErrors: { ...s.fieldErrors, work: undefined } }));
    if (!picked) return setFile(null);
    if (!mimeFromName(picked.name)) {
      setFile(null);
      setState((s) => ({ ...s, fieldErrors: { ...s.fieldErrors, work: "fileInvalid" } }));
    } else if (picked.size > MAX_SUBMISSION_FILE_BYTES) {
      setFile(null);
      setState((s) => ({ ...s, fieldErrors: { ...s.fieldErrors, work: "fileTooLarge" } }));
    } else {
      setFile(picked);
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const id = crypto.randomUUID();
      const formData = new FormData();
      formData.set("id", id);
      formData.set("studentId", studentId);
      formData.set("rubricId", rubricId);
      formData.set("taskPrompt", taskPrompt);
      formData.set("workType", workType);

      if (workType === "text") {
        formData.set("text", text);
      } else if (file) {
        // Upload straight from the browser to the tutor's private folder (Storage RLS checks it).
        const mime = mimeFromName(file.name)!;
        const path = `${tutorId}/${id}/work.${extFor(mime)}`;
        const { error } = await createClient()
          .storage.from("submissions")
          .upload(path, file, { contentType: mime, upsert: false });
        if (error) {
          setState({ formError: "uploadFailed" });
          return;
        }
        formData.set("filePath", path);
        formData.set("fileMime", mime);
      }

      // Redirects to the new submission on success.
      try {
        const result: NewSubmissionState = await createSubmission({}, formData);
        setState(result);
      } catch (error) {
        if (isRedirectError(error)) throw error; // let Next navigate
        setState({ formError: "generic" });
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="studentId" label={t("studentLabel")} error={err("studentId")}>
          <NativeSelect
            id="studentId"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            aria-invalid={!!errors.studentId || undefined}
            aria-describedby={describedBy("studentId", err("studentId"))}
          >
            <option value="" disabled>
              {t("studentPlaceholder")}
            </option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field id="rubricId" label={t("rubricLabel")} error={err("rubricId")}>
          <NativeSelect
            id="rubricId"
            value={rubricId}
            onChange={(e) => setRubricId(e.target.value)}
            aria-invalid={!!errors.rubricId || undefined}
            aria-describedby={describedBy("rubricId", err("rubricId"))}
          >
            <option value="" disabled>
              {t("rubricPlaceholder")}
            </option>
            {rubrics.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Field id="taskPrompt" label={t("taskPromptLabel")} hint={t("taskPromptHint")} error={err("taskPrompt")}>
        <Textarea
          id="taskPrompt"
          rows={3}
          maxLength={SUBMISSION_LIMITS.taskPrompt}
          placeholder={t("taskPromptPlaceholder")}
          value={taskPrompt}
          onChange={(e) => setTaskPrompt(e.target.value)}
          aria-invalid={!!errors.taskPrompt || undefined}
          aria-describedby={describedBy("taskPrompt", err("taskPrompt"), t("taskPromptHint"))}
        />
      </Field>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-medium">{t("workLabel")}</legend>
        <div role="tablist" className="inline-flex w-fit rounded-md border bg-muted p-0.5">
          {(["file", "text"] as const).map((type) => (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={workType === type}
              onClick={() => setWorkType(type)}
              className={cn(
                "rounded px-3 py-1 text-sm font-medium transition-colors",
                workType === type ? "bg-background shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {type === "file" ? t("workFile") : t("workText")}
            </button>
          ))}
        </div>

        {workType === "file" ? (
          <div className="grid gap-2">
            <input
              ref={fileInput}
              id="workFile"
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                <FileUp className="size-4 text-primary" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
                <span className="text-muted-foreground">{t("fileSize", { mb: (file.size / 1024 / 1024).toFixed(1) })}</span>
                <Button type="button" variant="ghost" size="icon" aria-label={t("removeFile")} onClick={() => setFile(null)}>
                  <X aria-hidden />
                </Button>
              </div>
            ) : (
              <label
                htmlFor="workFile"
                className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed bg-background px-4 py-8 text-center text-sm transition-colors hover:bg-accent"
              >
                <FileUp className="size-6 text-muted-foreground" aria-hidden />
                <span className="font-medium">{t("chooseFile")}</span>
                <span className="text-xs text-muted-foreground">{t("fileHint")}</span>
              </label>
            )}
          </div>
        ) : (
          <Textarea
            aria-label={t("workText")}
            rows={10}
            maxLength={SUBMISSION_LIMITS.text}
            placeholder={t("textPlaceholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={!!errors.work || undefined}
          />
        )}
        <FieldError message={err("work")} />
      </fieldset>

      <FieldError message={state.formError && t(`errors.${state.formError}`)} />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending || (workType === "file" && !file)}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {pending ? t("uploading") : t("submit")}
        </Button>
        <Button asChild variant="outline">
          <Link href={cancelHref}>{tCommon("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
