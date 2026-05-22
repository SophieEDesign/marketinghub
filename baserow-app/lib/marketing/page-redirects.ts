/**
 * Marketing workspace page redirects — keep planners on bespoke dashboards, not legacy block pages.
 */

const POST_CALENDAR_PAGE_NAMES = new Set([
  "post calendar overview",
  "planning calendar",
])

export function isPostCalendarOverviewPage(page: { name?: string } | null): boolean {
  if (!page) return false
  const name = String(page.name || "").trim().toLowerCase()
  if (POST_CALENDAR_PAGE_NAMES.has(name)) return true
  return name.includes("post calendar")
}

export function findPageIdByLayoutStyle(
  pages: Array<{ id: string; config?: unknown }>,
  layoutStyle: string
): string | null {
  const match = pages.find((p) => {
    const cfg = p.config as { layout_style?: string } | undefined
    return cfg?.layout_style === layoutStyle
  })
  return match?.id ?? null
}
