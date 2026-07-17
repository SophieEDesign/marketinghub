import { describe, expect, it } from "vitest"
import { isPageLevelSettingsContext } from "@/contexts/SelectionContext"

describe("isPageLevelSettingsContext", () => {
  it("returns true for page, block, and recordList contexts", () => {
    expect(isPageLevelSettingsContext({ type: "page" })).toBe(true)
    expect(isPageLevelSettingsContext({ type: "block", blockId: "b1" })).toBe(true)
    expect(isPageLevelSettingsContext({ type: "recordList", blockId: "b1" })).toBe(true)
  })

  it("returns false for record, field, and null contexts", () => {
    expect(isPageLevelSettingsContext({ type: "record", recordId: "r1" })).toBe(false)
    expect(isPageLevelSettingsContext({ type: "field", fieldId: "f1" })).toBe(false)
    expect(isPageLevelSettingsContext(null)).toBe(false)
  })
})
