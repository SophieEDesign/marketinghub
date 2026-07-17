import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { inferRecordLayoutTypeFromTableName } from "@/lib/records/infer-record-layout-type"
import { pickPageId } from "@/lib/marketing/marketing-page-links"
import { pageIdFromHref } from "@/lib/pages/prefetch-page-blocks"

const ROOT = join(__dirname, "..")

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("linked record layout preservation", () => {
  it("infers marketing layouts from table names", () => {
    expect(inferRecordLayoutTypeFromTableName("Campaigns")).toBe("campaign")
    expect(inferRecordLayoutTypeFromTableName("marketing_events")).toBe("event")
    expect(inferRecordLayoutTypeFromTableName("social_posts")).toBe("social_post")
    expect(inferRecordLayoutTypeFromTableName("Things To Do")).toBe("task")
    expect(inferRecordLayoutTypeFromTableName("Media Resources")).toBe("asset")
    expect(inferRecordLayoutTypeFromTableName("Content")).toBe("content")
    expect(inferRecordLayoutTypeFromTableName("contacts")).toBe("generic")
  })

  it("navigateToLinkedRecord uses inferRecordLayoutTypeFromTableName", () => {
    const src = readSource("contexts/RecordPanelContext.tsx")
    expect(src).toContain("inferRecordLayoutTypeFromTableName(tableName)")
    expect(src).not.toMatch(/navigateToLinkedRecord[\s\S]*?recordLayoutType: "generic"/)
  })
})

describe("Upcoming Summary view-all navigation", () => {
  it("routes sections to marketing workspace pages", () => {
    const src = readSource("components/interface/blocks/UpcomingSummaryBlock.tsx")
    expect(src).toContain("UPCOMING_SUMMARY_SECTION_PAGE_NAMES")
    expect(src).toContain("router.push(path)")
    expect(src).not.toContain("TODO: link to filtered view")
  })

  it("resolves page ids by canonical name", () => {
    const rows = [
      { id: "a", name: "Campaigns" },
      { id: "b", name: "Event Calendar" },
    ]
    expect(pickPageId(rows, ["Campaigns"])).toBe("a")
    expect(pickPageId(rows, ["Missing", "Event Calendar"])).toBe("b")
  })
})

describe("Content Timeline footer navigation", () => {
  it("navigates to content planning when configured", () => {
    const src = readSource("components/interface/blocks/ContentTimelineBlock.tsx")
    expect(src).toContain("CONTENT_TIMELINE_FOOTER_PAGE_NAMES")
    expect(src).toContain("handleFooterNavigate")
    expect(src).not.toContain("TODO: Navigate to full Content")
  })
})

describe("PERF-001 sidebar prefetch", () => {
  it("prefetches blocks API on sidebar hover", () => {
    const sidebar = readSource("components/layout/Sidebar.tsx")
    expect(sidebar).toContain("prefetchPageBlocks")
    expect(sidebar).toContain("onMouseEnter")
    expect(pageIdFromHref("/pages/abc-123")).toBe("abc-123")
  })
})

describe("Resource Hub manage drawer UX", () => {
  it("hides block DetailPanel while global record drawer is open", () => {
    const src = readSource("components/interface/blocks/InternalResourceHubBlock.tsx")
    expect(src).toContain("isRecordModalOpen")
    expect(src).toContain("showSideDetailPanel")
  })
})

describe("campaigns mock key contract", () => {
  it("prefers campaigns_overview_use_mock with legacy fallback", () => {
    expect(readSource("hooks/useCampaignsOverviewData.ts")).toContain(
      '"campaigns_overview_use_mock"'
    )
    expect(readSource("components/interface/settings/CampaignsOverviewDataSettings.tsx")).toContain(
      'legacyMockKey="campaigns_use_mock"'
    )
  })
})

describe("Members Welcome edit mode links", () => {
  it("does not navigate view-all links while editing layout", () => {
    const src = readSource("components/interface/blocks/MembersWelcomeBlock.tsx")
    expect(src).toContain("links.events && !isEditing")
    expect(src).toContain("links.resources && !isEditing")
    expect(src).toContain("links.help && !isEditing")
  })
})

describe("orphan drawer components", () => {
  const orphans = [
    "components/interface/EventDetailDrawer.tsx",
    "components/interface/things-to-do/ThingsToDoDetailPanel.tsx",
    "components/interface/social/SocialPostQuickView.tsx",
  ]

  it.each(orphans)("%s is marked deprecated", (file) => {
    expect(readSource(file)).toContain("@deprecated")
  })
})
