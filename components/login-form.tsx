"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  /** Locale-aware path to land on after sign-in, e.g. "/dashboard" or "/ru/dashboard". */
  next: string;
  googleEnabled: boolean;
  authFailed: boolean;
};

type ErrorKey = "generic" | "invalidEmail" | "rateLimited" | "authFailed";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm({ next, googleEnabled, authFailed }: Props) {
  const t = useTranslations("login");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<ErrorKey | null>(authFailed ? "authFailed" : null);

  const redirectTo = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError("invalidEmail");
      return;
    }

    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: value,
      options: { emailRedirectTo: redirectTo(), shouldCreateUser: true },
    });

    if (error) {
      setStatus("idle");
      setError(error.status === 429 ? "rateLimited" : "generic");
      return;
    }
    setStatus("sent");
  }

  async function signInWithGoogle() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) setError("generic");
  }

  if (status === "sent") {
    return (
      <Card>
        <CardHeader className="justify-items-center text-center">
          <MailCheck className="mb-2 size-10 text-primary" aria-hidden />
          <CardTitle className="text-xl">{t("sentTitle")}</CardTitle>
          <CardDescription>{t("sentBody", { email: email.trim() })}</CardDescription>
          <CardDescription>{t("sentHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button variant="link" onClick={() => setStatus("idle")}>
            {t("useAnother")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form onSubmit={sendMagicLink} className="grid gap-4" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error === "invalidEmail" || undefined}
              aria-describedby={error ? "login-error" : undefined}
              required
            />
          </div>

          {error && (
            <p id="login-error" role="alert" className="text-sm text-destructive">
              {t(`errors.${error}`)}
            </p>
          )}

          <Button type="submit" disabled={status === "sending"}>
            {status === "sending" && <Loader2 className="animate-spin" aria-hidden />}
            {status === "sending" ? t("sending") : t("submit")}
          </Button>
        </form>

        {googleEnabled && (
          <>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {t("or")}
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button type="button" variant="outline" onClick={signInWithGoogle}>
              <GoogleIcon />
              {t("google")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path fill="#4285F4" d="M23.5 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.73Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.28a12 12 0 0 0 0 10.8l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.28 6.6l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75Z" />
    </svg>
  );
}
