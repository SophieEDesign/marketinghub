import { describe, it, expect } from "vitest"
import {
  allowInternalScrollFromDisplaySettings,
  effectiveAllowInternalScroll,
  shouldUseFullPageInternalScroll,
} from "@/lib/interface/block-display-settings"

describe("block-display-settings full-page scroll", () => {
  it("shouldUseFullPageInternalScroll is true only when isFullPage", () => {
    expect(shouldUseFullPageInternalScroll(true)).toBe(true)
    expect(shouldUseFullPageInternalScroll(false)).toBe(false)
  })

  it("allowInternalScrollFromDisplaySettings requires fixed + scroll", () => {
    expect(allowInternalScrollFromDisplaySettings("fit", "view_all")).toBe(false)
    expect(allowInternalScrollFromDisplaySettings("fixed", "scroll")).toBe(true)
    expect(allowInternalScrollFromDisplaySettings("fixed", "paginate")).toBe(false)
  })

  it("effectiveAllowInternalScroll enables scroll in full-page mode regardless of display settings", () => {
    expect(effectiveAllowInternalScroll(true, "fit", "view_all")).toBe(true)
    expect(effectiveAllowInternalScroll(false, "fit", "view_all")).toBe(false)
    expect(effectiveAllowInternalScroll(false, "fixed", "scroll")).toBe(true)
  })
})
