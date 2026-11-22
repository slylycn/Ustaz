const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_CHARS = /^\+?[\d\s\-()]+$/;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Digits, spaces, +, -, ( ) and 10–15 digits in total. */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return PHONE_CHARS.test(value) && digits.length >= 10 && digits.length <= 15;
}

/** Trimmed string value of a form field ("" when missing). */
export function formText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * A same-site path without locale prefix (e.g. "/students/123?tab=lessons"),
 * or the fallback. Prevents open redirects to other sites.
 */
export function safeReturnTo(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}
