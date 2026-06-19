import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { getAllBlockTypes, BLOCK_REGISTRY } from "@/lib/interface/registry"
import {
  isMarketingHomePage,
  isMarketingHubWorkspacePage,
  pickMarketingHomePageId,
} from "@/lib/marketing/marketing-home"

const scriptPath = join(process.cwd(), "scripts/apply-marketing-hub-workspace.cjs")
const scriptSrc = readFileSync(scriptPath, "utf8")

function extractBuilder(name: string): string {
  const start = scriptSrc.indexOf(`function ${name}(`)
  if (start < 0) return ""
  const nextFn = scriptSrc.indexOf("\nfunction ", start + 1)
  const end = nextFn < 0 ? scriptSrc.length : nextFn
  return scriptSrc.slice(start, end)
}

function blockTypesInBuilder(name: string): string[] {
  const body = extractBuilder(name)
  const matches = body.matchAll(/type:\s*"([^"]+)"/g)
  return [...matches].map((m) => m[1])
}

describe("apply-marketing-hub-workspace.cjs", () => {
  it("does not set layout_style on pages", () => {
    expect(scriptSrc).not.toMatch(/layout_style:\s*["']/)
    expect(scriptSrc).not.toMatch(/config:\s*\{\s*layout_style/)
  })

  it("uses syncPageBlocks for idempotent provisioning", () => {
    expect(scriptSrc).toContain("syncPageBlocks")
    expect(scriptSrc).toContain("provisioning_key")
  })

  it("does not provision Campaign Workspace", () => {
    expect(scriptSrc).not.toMatch(/name:\s*"Campaign Workspace"/)
    expect(scriptSrc).toContain("Campaign Workspace")
  })

  it("provisions all nine workspace pages", () => {
    for (const pageName of [
      "Members Welcome",
      "Marketing Home",
      "Theme Workspace",
      "Campaigns",
      "Content Planning",
      "Things To Do",
      "Resource Hub",
      "Social Calendar",
      "Event Calendar",
    ]) {
      expect(scriptSrc).toContain(`name: "${pageName}"`)
    }
  })

  it("Campaigns page blocks", () => {
    const types = blockTypesInBuilder("buildCampaignsBlocks")
    expect(types).toContain("campaigns_overview")
  })

  it("Marketing Home blocks", () => {
    const body = extractBuilder("buildMarketingHomeBlocks")
    expect(body).toContain("home_intro")
    expect(body).toContain("introBlock")
    const types = blockTypesInBuilder("buildMarketingHomeBlocks")
    expect(types).toContain("kpi_summary")
    expect(types).toContain("things_to_do")
    expect(types).toContain("content_theme")
    expect(types).toContain("content_timeline")
    expect(types).toContain("internal_resource_hub")
    expect(types).toContain("event_calendar")
    expect(types).not.toContain("social_media_calendar")
  })

  it("Theme Workspace blocks", () => {
    const types = blockTypesInBuilder("buildThemeWorkspaceBlocks")
    expect(types).toContain("content_theme")
    expect(types).toContain("content_timeline")
    expect(types).toContain("things_to_do")
  })

  it("Content Planning blocks", () => {
    const types = blockTypesInBuilder("buildContentPlanningBlocks")
    expect(types).toContain("things_to_do")
    expect(types).toContain("content_timeline")
    expect(types).toContain("social_media_calendar")
    expect(types).toContain("content_theme")
  })

  it("Things To Do page blocks", () => {
    const types = blockTypesInBuilder("buildThingsToDoBlocks")
    expect(types).toContain("things_to_do")
    expect(types.filter((t) => t === "things_to_do").length).toBeGreaterThanOrEqual(1)
  })

  it("Resource Hub blocks", () => {
    const types = blockTypesInBuilder("buildResourceHubBlocks")
    expect(types).toContain("internal_resource_hub")
    expect(types).toContain("drive_gallery")
    expect(types).toContain("things_to_do")
  })

  it("Social Calendar blocks", () => {
    const types = blockTypesInBuilder("buildSocialCalendarBlocks")
    expect(types).toContain("social_media_calendar")
  })

  it("Event Calendar blocks", () => {
    const types = blockTypesInBuilder("buildEventCalendarBlocks")
    expect(types).toContain("event_calendar")
  })

  it("Members Welcome blocks", () => {
    const body = extractBuilder("buildMembersWelcomeBlocks")
    const types = blockTypesInBuilder("buildMembersWelcomeBlocks")
    expect(body).toContain("members_welcome_main")
    expect(types).toEqual(["members_welcome"])
    expect(body).toContain("is_full_page: true")
  })
})

describe("Marketing Hub block registry", () => {
  const required = [
    "kpi_summary",
    "content_theme",
    "content_timeline",
    "internal_resource_hub",
    "social_media_calendar",
    "event_calendar",
    "things_to_do",
    "campaigns_overview",
    "members_welcome",
    "drive_gallery",
    "html",
  ]

  it("registers all custom block types", () => {
    const types = getAllBlockTypes()
    for (const t of required) {
      expect(types).toContain(t)
      expect(BLOCK_REGISTRY[t as keyof typeof BLOCK_REGISTRY]).toBeDefined()
    }
  })
})

describe("marketing-home helpers", () => {
  it("detects home by is_home and name", () => {
    expect(isMarketingHomePage({ name: "Marketing Home", config: { is_home: true } })).toBe(true)
    expect(isMarketingHomePage({ name: "Dashboard", config: {} })).toBe(true)
    expect(isMarketingHomePage({ name: "Theme Workspace", config: {} })).toBe(false)
  })

  it("picks marketing home page preferring is_home flag", () => {
    const id = pickMarketingHomePageId([
      { id: "theme-id", name: "Theme Workspace", config: {} },
      { id: "dash-id", name: "Dashboard", config: {} },
      { id: "home-id", name: "Marketing Home", config: { is_home: true } },
    ])
    expect(id).toBe("home-id")
  })

  it("detects workspace pages without layout_style", () => {
    expect(isMarketingHubWorkspacePage({ name: "Content Planning" })).toBe(true)
    expect(isMarketingHubWorkspacePage({ name: "Things To Do" })).toBe(true)
    expect(isMarketingHubWorkspacePage({ name: "Members Welcome" })).toBe(true)
    expect(isMarketingHubWorkspacePage({ name: "Random Page" })).toBe(false)
  })
})

describe("InterfacePageClient routing", () => {
  it("does not use bespoke calendar dashboard bypasses", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/InterfacePageClient.tsx"),
      "utf8"
    )
    expect(src).not.toContain("EventCalendarDashboard")
    expect(src).not.toContain("showEventCalendar")
    expect(src).not.toContain("SocialMediaCalendarDashboard")
    expect(src).not.toContain("ThemeOverviewDashboard")
    expect(src).not.toContain("ContentPlanningDashboard")
  })

  it("applies marketing shell to hub workspace pages", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/InterfacePageClient.tsx"),
      "utf8"
    )
    expect(src).toContain("isMarketingHubWorkspacePage")
  })
})
