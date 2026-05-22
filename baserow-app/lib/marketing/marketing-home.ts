import type { InterfacePage } from "@/lib/interface/page-types-only"

/** When true, marketing home renders shell placeholder instead of dashboard widgets. */
export const SHOW_MARKETING_HOME_PLACEHOLDER = false

const HOME_NAMES = new Set([
  "marketing dashboard",
  "marketing home",
  "home",
  "dashboard",
])

/** Canonical Marketing Hub workspace pages (Interface Builder canvas). */
const WORKSPACE_PAGE_NAMES = new Set([
  "marketing home",
  "theme workspace",
  "content planning",
  "things to do",
  "resource hub",
  "social calendar",
  "social media calendar",
  "event calendar",
  // Legacy names still in nav until reprovisioned
  "internal staff hub",
])

export function isMarketingHomePage(
  page: Pick<InterfacePage, "name" | "config"> | null | undefined
): boolean {
  if (!page) return false
  const cfg = page.config as { is_home?: boolean } | undefined
  const name = (page.name || "").trim().toLowerCase()
  return cfg?.is_home === true || HOME_NAMES.has(name)
}

export function isMarketingHubWorkspacePage(
  page: Pick<InterfacePage, "name"> | null | undefined
): boolean {
  if (!page) return false
  const name = (page.name || "").trim().toLowerCase()
  return WORKSPACE_PAGE_NAMES.has(name)
}
