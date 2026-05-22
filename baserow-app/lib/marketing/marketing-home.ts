import type { InterfacePage } from "@/lib/interface/page-types-only"

/** When true, marketing home renders shell placeholder instead of dashboard widgets. */
export const SHOW_MARKETING_HOME_PLACEHOLDER = false

const HOME_NAMES = new Set([
  "marketing dashboard",
  "marketing home",
  "home",
  "dashboard",
])

export function isMarketingHomePage(
  page: Pick<InterfacePage, "name" | "config"> | null | undefined
): boolean {
  if (!page) return false
  const cfg = page.config as { layout_style?: string; is_home?: boolean } | undefined
  const name = (page.name || "").trim().toLowerCase()
  return (
    cfg?.layout_style === "marketing_dashboard" ||
    cfg?.layout_style === "marketing_home" ||
    cfg?.is_home === true ||
    HOME_NAMES.has(name)
  )
}
