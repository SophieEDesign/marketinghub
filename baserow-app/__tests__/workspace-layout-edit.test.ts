import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

describe("unified workspace layout edit", () => {
  it("hook enters sidebar, block scope, and editPages together", () => {
    const src = readFileSync(
      join(process.cwd(), "hooks/useWorkspaceLayoutEdit.ts"),
      "utf8"
    )
    expect(src).toContain("enterSidebar()")
    expect(src).toContain("enterBlock()")
    expect(src).toContain("enterEditPages(pageId)")
    expect(src).toContain("exitSidebar()")
    expect(src).toContain("exitBlock()")
    expect(src).toContain("exitEditPages()")
  })

  it("sidebar Edit control uses unified workspace toggle", () => {
    const src = readFileSync(
      join(process.cwd(), "components/layout/AirtableSidebar.tsx"),
      "utf8"
    )
    expect(src).toContain("useWorkspaceLayoutEdit")
    expect(src).toContain("toggleWorkspaceEdit")
    expect(src).not.toContain("Done organising")
    expect(src).toContain(">Edit<")
  })

  it("page header renders Edit page button", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/InterfacePageClient.tsx"),
      "utf8"
    )
    expect(src).toContain("Edit page")
    expect(src).toContain("enterWorkspaceEdit")
    expect(src).toContain("exitWorkspaceEdit")
  })

  it("PageActionsRegistrar uses unified enter (not sidebar-only exit)", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/PageActionsRegistrar.tsx"),
      "utf8"
    )
    expect(src).toContain("enterWorkspaceEdit()")
    expect(src).toContain("exitWorkspaceEdit()")
    expect(src).not.toContain("exitSidebarEdit()")
  })

  it("InterfaceBuilder Done exits full workspace edit", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/InterfaceBuilder.tsx"),
      "utf8"
    )
    expect(src).toContain("exitWorkspaceEdit()")
  })

  it("InterfacePageClient re-targets editPages on navigation", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/InterfacePageClient.tsx"),
      "utf8"
    )
    expect(src).toContain('uiMode === "editPages"')
    expect(src).toContain("enterWorkspaceEdit()")
  })

  it("InterfaceBuilder receives editing when layout edit is active", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/InterfacePageClient.tsx"),
      "utf8"
    )
    expect(src).toContain("hideHeader={!isPageLayoutEditing}")
    expect(src).toContain("isPageLayoutEditing={isEditing}")
  })
})
