/** True when `error` was thrown by `redirect()` / `permanentRedirect()` (must be re-thrown). */
export function isNextRedirectError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const e = error as { digest?: string; message?: string }
  return (
    (typeof e.digest === "string" && e.digest.startsWith("NEXT_REDIRECT")) ||
    (typeof e.message === "string" && e.message.includes("NEXT_REDIRECT"))
  )
}
