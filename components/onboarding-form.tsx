"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { saveTutorProfile, type OnboardingState } from "@/lib/actions/onboarding";
import { EXAMS, OUTPUT_LANGUAGES, isOutputLanguage, type Exam, type OutputLanguage } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  defaultName: string;
  defaultLanguage: OutputLanguage;
};

const initialState: OnboardingState = {};

export function OnboardingForm({ defaultName, defaultLanguage }: Props) {
  const t = useTranslations("onboarding");
  const tExams = useTranslations("exams");
  const tExamDesc = useTranslations("examDescriptions");
  const tLang = useTranslations("outputLanguages");

  const [state, formAction, pending] = useActionState(saveTutorProfile, initialState);

  // Controlled so values survive a failed submit (React resets uncontrolled form fields).
  const [fullName, setFullName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [exams, setExams] = useState<Exam[]>([]);
  const [language, setLanguage] = useState<OutputLanguage>(defaultLanguage);

  const errors = state.fieldErrors ?? {};

  function toggleExam(exam: Exam, checked: boolean) {
    setExams((prev) =>
      checked ? [...prev, exam] : prev.filter((e) => e !== exam),
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-6" noValidate>
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="fullName">{t("nameLabel")}</Label>
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              maxLength={100}
              placeholder={t("namePlaceholder")}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              aria-invalid={!!errors.fullName || undefined}
              aria-describedby={errors.fullName ? "fullName-error" : undefined}
              required
            />
            <FieldError id="fullName-error" message={errors.fullName && t(`errors.${errors.fullName}`)} />
          </div>

          {/* Phone */}
          <div className="grid gap-2">
            <Label htmlFor="phone">{t("phoneLabel")}</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              maxLength={30}
              placeholder={t("phonePlaceholder")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={!!errors.phone || undefined}
              aria-describedby={errors.phone ? "phone-error" : undefined}
            />
            <FieldError id="phone-error" message={errors.phone && t(`errors.${errors.phone}`)} />
          </div>

          {/* Exams (multi-select) */}
          <fieldset className="grid gap-3" aria-describedby="exams-hint">
            <legend className="text-sm font-medium">{t("examsLabel")}</legend>
            <p id="exams-hint" className="-mt-1 text-sm text-muted-foreground">
              {t("examsHint")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {EXAMS.map((exam) => {
                const checked = exams.includes(exam);
                return (
                  <label
                    key={exam}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-accent",
                      checked && "border-primary bg-primary/5 hover:bg-primary/10",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggleExam(exam, v === true)}
                      className="mt-0.5"
                    />
                    <span className="grid gap-0.5">
                      <span className="text-sm font-medium">{tExams(exam)}</span>
                      <span className="text-xs text-muted-foreground">{tExamDesc(exam)}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {exams.map((exam) => (
              <input key={exam} type="hidden" name="exams" value={exam} />
            ))}
            <FieldError message={errors.exams && t(`errors.${errors.exams}`)} />
          </fieldset>

          {/* Output language */}
          <fieldset className="grid gap-3" aria-describedby="language-hint">
            <legend className="text-sm font-medium">{t("outputLanguageLabel")}</legend>
            <p id="language-hint" className="-mt-1 text-sm text-muted-foreground">
              {t("outputLanguageHint")}
            </p>
            <RadioGroup
              value={language}
              onValueChange={(v) => isOutputLanguage(v) && setLanguage(v)}
              className="flex flex-wrap gap-2"
            >
              {OUTPUT_LANGUAGES.map((lang) => (
                <label
                  key={lang}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                    language === lang && "border-primary bg-primary/5 hover:bg-primary/10",
                  )}
                >
                  <RadioGroupItem value={lang} />
                  {tLang(lang)}
                </label>
              ))}
            </RadioGroup>
            <input type="hidden" name="outputLanguage" value={language} />
            <FieldError message={errors.outputLanguage && t(`errors.${errors.outputLanguage}`)} />
          </fieldset>

          <FieldError message={state.formError && t(`errors.${state.formError}`)} />

          <Button type="submit" disabled={pending} className="justify-self-start">
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {pending ? t("saving") : t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}
