/**
 * Best-effort client IP for rate limiting (trusts x-forwarded-for from the platform edge).
 */
export function getRequestIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  )
}
