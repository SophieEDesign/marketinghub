import {
  blockWantsFullPageLayout,
  fullPageToggleConfigUpdates,
  resolveFullPageBlockId,
} from "@/lib/interface/full-page-layout"
import type { PageBlock } from "@/lib/interface/types"

function block(partial: Partial<PageBlock> & Pick<PageBlock, "id" | "type">): PageBlock {
  return {
    page_id: "page-1",
    x: 0,
    y: 0,
    w: 12,
    h: 20,
    config: {},
    ...partial,
  } as PageBlock
}

describe("full-page-layout", () => {
  it("resolveFullPageBlockId uses is_full_page for social calendar", () => {
    const b = block({
      id: "b1",
      type: "social_media_calendar",
      config: { is_full_page: true },
    })
    expect(resolveFullPageBlockId([b])).toBe("b1")
  })

  it("explicit is_full_page false opts out even when social mode is full", () => {
    const b = block({
      id: "b1",
      type: "social_media_calendar",
      config: { social_media_calendar_mode: "full", is_full_page: false },
    })
    expect(blockWantsFullPageLayout(b)).toBe(false)
    expect(resolveFullPageBlockId([b])).toBeNull()
  })

  it("fullPageToggleConfigUpdates sets compact mode when disabling social calendar", () => {
    expect(fullPageToggleConfigUpdates("social_media_calendar", false)).toEqual({
      is_full_page: false,
      social_media_calendar_mode: "compact",
    })
  })

  it("campaigns without is_full_page does not auto-enter full-page", () => {
    const b = block({
      id: "b1",
      type: "campaigns_overview",
      config: { table_id: "t1" },
    })
    expect(resolveFullPageBlockId([b])).toBeNull()
  })

  it("campaigns with is_full_page true uses full-page", () => {
    const b = block({
      id: "b1",
      type: "campaigns_overview",
      config: { table_id: "t1", is_full_page: true },
    })
    expect(resolveFullPageBlockId([b])).toBe("b1")
  })

  it("resolveFullPageBlockId returns null when multiple blocks", () => {
    const a = block({ id: "a", type: "text", config: { is_full_page: true } })
    const b = block({ id: "b", type: "text", config: {} })
    expect(resolveFullPageBlockId([a, b])).toBeNull()
  })

  it("calendar grid defaults to full page when is_full_page unset", () => {
    const b = block({
      id: "b1",
      type: "grid",
      config: { view_type: "calendar", table_id: "t1" },
    })
    expect(resolveFullPageBlockId([b])).toBe("b1")
  })

  it("calendar grid respects is_full_page false (Planning Calendar opt-out)", () => {
    const b = block({
      id: "b1",
      type: "grid",
      config: { view_type: "calendar", is_full_page: false, table_id: "t1" },
    })
    expect(blockWantsFullPageLayout(b)).toBe(false)
    expect(resolveFullPageBlockId([b])).toBeNull()
  })

  it("explicit is_full_page false opts out of marketing defaultFullPage", () => {
    const b = block({
      id: "b1",
      type: "campaigns_overview",
      config: { is_full_page: false },
    })
    expect(resolveFullPageBlockId([b])).toBeNull()
  })
})
