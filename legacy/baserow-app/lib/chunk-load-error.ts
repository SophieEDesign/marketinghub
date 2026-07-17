/** Session key: one automatic reload per tab session after a chunk load failure. */
export const CHUNK_RELOAD_SESSION_KEY = "mh-chunk-reload-attempted"

const CHUNK_ERROR_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk \d+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
]

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === "string"
        ? error
        : String(error)
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message))
}

/**
 * After a deploy, open tabs may still reference old hashed chunks (404 on CDN).
 * Reload once so the browser picks up the current build manifest.
 */
export function reloadOnceForStaleChunks(): boolean {
  if (typeof window === "undefined") return false
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY)) return false
    sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, "1")
    window.location.reload()
    return true
  } catch {
    window.location.reload()
    return true
  }
}

export function clearChunkReloadFlag(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY)
  } catch {
    // ignore
  }
}
