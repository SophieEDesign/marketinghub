const inflight = new Map<string, Promise<void>>()
const warmed = new Set<string>()

/**
 * Warm the blocks API for a page on sidebar hover (PERF-001).
 * Does not parse or store response — navigation still uses InterfacePageClient.loadBlocks.
 */
export function prefetchPageBlocks(pageId: string | undefined | null): void {
  const id = pageId?.trim()
  if (!id || warmed.has(id) || inflight.has(id)) return

  const request = fetch(`/api/pages/${id}/blocks`, { credentials: "same-origin" })
    .then(() => {
      warmed.add(id)
    })
    .catch(() => {
      // Allow retry on next hover
    })
    .finally(() => {
      inflight.delete(id)
    })

  inflight.set(id, request)
}

export function pageIdFromHref(href: string | undefined): string | null {
  if (!href) return null
  const match = href.match(/^\/pages\/([^/?#]+)/)
  return match?.[1] ?? null
}
