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

  it("keeps full-page layout chromeless in edit mode until selected", () => {
    const unselected = builderBlockFrameClassName({
      isEditing: true,
      isSelected: false,
      isFullPageLayout: true,
    })
    expect(unselected).toContain("bg-transparent")
    expect(unselected).not.toContain("border-dashed")
    expect(unselected).not.toContain("shadow-card")

    const selected = builderBlockFrameClassName({
      isEditing: true,
      isSelected: true,
      isFullPageLayout: true,
    })
    expect(selected).toContain("ring-inset")
    expect(selected).toContain("ring-accent-link")
  })
})

describe("BlockAppearanceWrapper — full-page edit outline", () => {
  it("shows layout-edit ring only when full-page block is selected", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/BlockAppearanceWrapper.tsx"),
      "utf8"
    )
    expect(src).toContain("isLayoutSelected")
    expect(src).toMatch(/isLayoutEditing[\s\S]*isLayoutSelected[\s\S]*ring-inset/)
  })
})

describe("InterfacePageClient — viewport-filling layouts in edit mode", () => {
  it("does not add grid edit padding when main scroll is suppressed", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/InterfacePageClient.tsx"),
      "utf8"
    )
    expect(src).toMatch(/isEditMode && !suppressMainScroll \? "pb-48"/)
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

  it("hides InterfaceBuilder toolbar (shell EditModeBanner + sidebar)", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/InterfacePageClient.tsx"),
      "utf8"
    )
    expect(src).toContain("hideHeader={true}")
  })
})
