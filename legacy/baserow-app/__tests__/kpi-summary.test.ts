import { describe, expect, it } from "vitest"
import {
  dateRangesForComparisonPreset,
  formatKpiSummaryTrend,
  formatKpiSummaryValue,
  resolveKpiSummaryCardTable,
  resolveKpiSummaryTableSource,
} from "@/lib/marketing/kpi-summary"
import type { MarketingTableRow } from "@/lib/marketing/marketing-tables"

const tables: MarketingTableRow[] = [
  { id: "t1", name: "Campaigns", supabase_table: "campaigns" },
  { id: "t2", name: "Content", supabase_table: "content" },
  { id: "t3", name: "Social Posts", supabase_table: "social_posts" },
]

describe("kpi-summary", () => {
  it("resolves table sources by name", () => {
    expect(resolveKpiSummaryTableSource(tables, "campaigns")?.id).toBe("t1")
    expect(resolveKpiSummaryTableSource(tables, "content")?.id).toBe("t2")
    expect(resolveKpiSummaryTableSource(tables, "social_posts")?.id).toBe("t3")
  })

  it("prefers explicit table_id on card", () => {
    const card = {
      id: "x",
      label: "X",
      icon: "rocket",
      accent: "purple" as const,
      table_id: "t2",
      table_source: "campaigns" as const,
    }
    expect(resolveKpiSummaryCardTable(tables, card)?.id).toBe("t2")
  })

  it("formats compact values", () => {
    expect(formatKpiSummaryValue(8300, "compact", "count")).toMatch(/8/)
  })

  it("builds last_7_days comparison ranges", () => {
    const now = new Date("2026-06-01T12:00:00.000Z")
    const ranges = dateRangesForComparisonPreset("last_7_days", now)
    expect(ranges).not.toBeNull()
    expect(ranges!.currentStart).toBeTruthy()
    expect(ranges!.previousEnd).toBeTruthy()
  })

  it("formats trend from comparison result", () => {
    const { trend, trend_direction } = formatKpiSummaryTrend(
      {
        current: 12,
        previous: 10,
        change: 2,
        changePercent: 20,
        trend: "up",
      },
      "last_7_days"
    )
    expect(trend).toContain("20%")
    expect(trend_direction).toBe("up")
  })
})
