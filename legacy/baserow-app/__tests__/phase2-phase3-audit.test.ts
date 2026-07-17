import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

describe("filter block wiring", () => {
  it("Canvas passes getFiltersForBlock into BlockRenderer", () => {
    const source = readFileSync(
      join(process.cwd(), "components/interface/Canvas.tsx"),
      "utf8"
    )
    expect(source).toContain("getFiltersForBlock")
    expect(source).toContain("filters={getFiltersForBlock(")
  })

  it("GridBlock accepts page-level filters prop", () => {
    const source = readFileSync(
      join(process.cwd(), "components/interface/blocks/GridBlock.tsx"),
      "utf8"
    )
    expect(source).toContain("filters?: FilterConfig[]")
    expect(source).toContain("mergeFilters")
  })
})

describe("useTablesRegistry adoption", () => {
  const marketingHooks = [
    "useContentTimelineData.ts",
    "useEventCalendarData.ts",
    "useThingsToDoData.ts",
    "useUpcomingSummaryData.ts",
    "useCampaignsOverviewData.ts",
    "useContentThemeData.ts",
    "useSocialMediaCalendarData.ts",
    "useKpiSummaryData.ts",
    "useResourceHubData.ts",
  ]

  for (const file of marketingHooks) {
    it(`${file} uses shared useTablesRegistry`, () => {
      const source = readFileSync(join(process.cwd(), "hooks", file), "utf8")
      expect(source).toContain("useTablesRegistry")
      expect(source).not.toMatch(/from\("tables"\)/)
    })
  }
})
