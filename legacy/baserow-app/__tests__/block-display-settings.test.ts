import { describe, it, expect } from "vitest"
import {
  allowInternalScrollFromDisplaySettings,
  effectiveAllowInternalScroll,
  shouldUseFullPageInternalScroll,
} from "@/lib/interface/block-display-settings"
import { isConfigFullPage, marketingBlockRootClass } from "@/lib/interface/marketing-block-layout"

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

describe("marketing-block-layout", () => {
  it("isConfigFullPage reads is_full_page from config", () => {
    expect(isConfigFullPage({ is_full_page: true })).toBe(true)
    expect(isConfigFullPage({})).toBe(false)
  })

  it("isConfigFullPage only uses explicit is_full_page flag", () => {
    expect(
      isConfigFullPage({ social_media_calendar_mode: "full", is_full_page: false })
    ).toBe(false)
    expect(isConfigFullPage({ table_id: "t1" })).toBe(false)
    expect(isConfigFullPage({ is_full_page: true })).toBe(true)
  })

  it("marketingBlockRootClass strips card chrome in full-page mode", () => {
    expect(marketingBlockRootClass(true, "rounded-2xl border")).toContain("rounded-none")
    expect(marketingBlockRootClass(true, "rounded-2xl border")).not.toContain("rounded-2xl")
    expect(marketingBlockRootClass(false, "rounded-2xl border")).toContain("rounded-2xl")
  })
})
