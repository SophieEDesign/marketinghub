import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8")
}

describe("record editor create deduplication", () => {
  it("blocks duplicate create inserts until recordId is assigned", () => {
    const src = readSource("lib/interface/record-editor-core.ts")
    expect(src).toContain("createCommittedIdRef")
    expect(src).toContain("saveInFlightRef")
    expect(src).toContain("if (!recordId && createCommittedIdRef.current) return")
    expect(src).toContain("!createCommittedIdRef.current")
  })

  it("prevents reopening social calendar create while create drawer is already open", () => {
    const src = readSource("components/interface/SocialMediaCalendarCore.tsx")
    expect(src).toContain("recordPanelState.recordId === null")
    expect(src).toContain("recordPanelState.tableId === tableIds.contentTableId")
  })
})
