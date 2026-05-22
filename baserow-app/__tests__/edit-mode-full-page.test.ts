import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import {
  shouldShowBlockChromeToolbar,
  isCanvasFullPageMode,
} from "@/lib/interface/canvas-edit-chrome"
import { builderBlockFrameClassName } from "@/components/interface/primitives/BuilderBlockFrame"

describe("canvas edit chrome — full-page blocks", () => {
  it("shows toolbar in edit mode for full-page block even when not selected", () => {
    expect(
      shouldShowBlockChromeToolbar({
        isEditing: true,
        isFullPageMode: true,
        isThisFullPageBlock: true,
        isBlockSelected: false,
      })
    ).toBe(true)
  })

  it("hides toolbar in view mode for full-page block", () => {
    expect(
      shouldShowBlockChromeToolbar({
        isEditing: false,
        isFullPageMode: true,
        isThisFullPageBlock: true,
        isBlockSelected: false,
      })
    ).toBe(false)
  })

  it("does not treat multi-block pages as full-page canvas mode", () => {
    expect(
      isCanvasFullPageMode("block-a", [
        { id: "block-a" },
        { id: "block-b" },
      ])
    ).toBe(false)
  })

  it("activates full-page canvas mode for a single eligible block", () => {
    expect(isCanvasFullPageMode("block-a", [{ id: "block-a" }])).toBe(true)
  })

  it("applies full-page layout ring classes in edit mode", () => {
    const cls = builderBlockFrameClassName({
      isEditing: true,
      isSelected: false,
      isFullPageLayout: true,
    })
    expect(cls).toContain("ring-inset")
    expect(cls).toContain("ring-accent-link")
  })
})

describe("BlockAppearanceWrapper — full-page edit outline", () => {
  it("renders layout-edit ring when isFullPage and isLayoutEditing", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/BlockAppearanceWrapper.tsx"),
      "utf8"
    )
    expect(src).toContain("isLayoutEditing")
    expect(src).toMatch(/isFullPage[\s\S]*isLayoutEditing[\s\S]*ring-inset/)
  })
})

describe("InterfacePageClient — layout edit follows navigation", () => {
  it("re-targets editPages to the current page when uiMode is editPages", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/InterfacePageClient.tsx"),
      "utf8"
    )
    expect(src).toContain('uiMode === "editPages"')
    expect(src).toContain("enterWorkspaceEdit()")
  })

  it("shows InterfaceBuilder toolbar when page layout editing", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/InterfacePageClient.tsx"),
      "utf8"
    )
    expect(src).toContain("hideHeader={!isPageLayoutEditing}")
  })
})
