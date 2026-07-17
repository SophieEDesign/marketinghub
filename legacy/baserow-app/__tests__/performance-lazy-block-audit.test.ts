import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

const blockRenderer = readFileSync(
  join(process.cwd(), "components/interface/BlockRenderer.tsx"),
  "utf8"
)

describe("performance — LazyBlockWrapper audit", () => {
  it("uses deferBlockMount tied to isFullPage for viewport lazy loading", () => {
    expect(blockRenderer).toContain("const deferBlockMount = !isFullPage")
    expect(blockRenderer).toContain("enabled={deferBlockMount}")
  })

  it("keeps mount-stability blocks on enabled={false}", () => {
    expect(blockRenderer).toContain('LazyBlockWrapper enabled={false}')
    expect(blockRenderer).toMatch(/case "text":[\s\S]*?enabled=\{false\}/)
    expect(blockRenderer).toMatch(/case "record":[\s\S]*?enabled=\{false\}/)
    expect(blockRenderer).toMatch(/case "calendar":[\s\S]*?enabled=\{false\}/)
  })

  it("wraps KPI block with LazyBlockWrapper", () => {
    expect(blockRenderer).toMatch(/case "kpi":[\s\S]*?LazyBlockWrapper enabled=\{deferBlockMount\}/)
  })

  it("wraps marketing blocks with dynamic import and deferBlockMount", () => {
    for (const block of [
      "ContentThemeBlock",
      "UpcomingSummaryBlock",
      "KPISummaryBlock",
      "EventCalendarBlock",
      "InternalResourceHubBlock",
    ]) {
      expect(blockRenderer).toContain(`dynamic(() => import("./blocks/${block}")`)
    }
    expect(blockRenderer).toMatch(
      /case "event_calendar":[\s\S]*?enabled=\{deferBlockMount\}/
    )
  })
})
