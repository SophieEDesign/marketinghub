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
  "campaigns",
  "content planning",
  "things to do",
  "resource hub",
  "social calendar",
  "social media calendar",
  "event calendar",
  "members welcome",
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

/** Pick the canonical marketing dashboard / home page from a list (prefers `is_home`). */
export function pickMarketingHomePageId(
  pages: Array<Pick<InterfacePage, "id" | "name" | "config">>
): string | null {
  const homePages = pages.filter((p) => isMarketingHomePage(p))
  if (homePages.length === 0) return null
  const explicit = homePages.find(
    (p) => (p.config as { is_home?: boolean } | undefined)?.is_home === true
  )
  return (explicit ?? homePages[0]).id
}

export function isMarketingHubWorkspacePage(
  page: Pick<InterfacePage, "name"> | null | undefined
): boolean {
  if (!page) return false
  const name = (page.name || "").trim().toLowerCase()
  return WORKSPACE_PAGE_NAMES.has(name)
}
