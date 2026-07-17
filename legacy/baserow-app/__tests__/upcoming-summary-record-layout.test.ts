import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { resolveUpcomingSummaryRecordLayoutType } from "@/lib/marketing/upcoming-summary-record-layout"

describe("resolveUpcomingSummaryRecordLayoutType", () => {
  it("maps campaign section to campaign layout", () => {
    expect(resolveUpcomingSummaryRecordLayoutType("campaigns")).toBe("campaign")
  })

  it("maps event section to event layout", () => {
    expect(resolveUpcomingSummaryRecordLayoutType("events")).toBe("event")
  })

  it("maps published section to content layout", () => {
    expect(resolveUpcomingSummaryRecordLayoutType("published")).toBe("content")
  })

  it("maps task-like sections to task layout", () => {
    expect(resolveUpcomingSummaryRecordLayoutType("deadlines")).toBe("task")
    expect(resolveUpcomingSummaryRecordLayoutType("approval")).toBe("task")
    expect(resolveUpcomingSummaryRecordLayoutType("blockers")).toBe("task")
  })

  it("returns undefined for unknown sections (generic fallback)", () => {
    expect(
      resolveUpcomingSummaryRecordLayoutType(
        "unknown" as Parameters<typeof resolveUpcomingSummaryRecordLayoutType>[0]
      )
    ).toBeUndefined()
  })
})

describe("UpcomingSummaryBlock record open wiring", () => {
  const src = readFileSync(
    join(process.cwd(), "components/interface/blocks/UpcomingSummaryBlock.tsx"),
    "utf8"
  )

  it("uses resolveUpcomingSummaryRecordLayoutType when opening records", () => {
    expect(src).toContain("resolveUpcomingSummaryRecordLayoutType(section)")
    expect(src).toContain("...(recordLayoutType ? { recordLayoutType } : {})")
  })

  it("does not open records in page layout edit mode", () => {
    expect(src).toContain("if (!linksEnabled || isEditing) return")
  })
})
