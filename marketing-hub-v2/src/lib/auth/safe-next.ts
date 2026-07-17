/**
 * Only allow same-origin relative paths for post-login redirects.
 * Rejects protocol-relative, absolute, and empty-ish values.
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback: string
): string {
  if (!next || typeof next !== "string") return fallback;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://")) return fallback;
  if (trimmed.includes("\\")) return fallback;
  return trimmed;
}
