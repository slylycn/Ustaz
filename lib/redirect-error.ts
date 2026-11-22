/**
 * A server action that calls redirect() throws a special error on the client. When we wrap an
 * action in try/catch to show our own error message, that one must be re-thrown so Next.js can
 * navigate. (Same check as Next's internal isRedirectError, which isn't a stable public API.)
 */
export function isRedirectError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}
