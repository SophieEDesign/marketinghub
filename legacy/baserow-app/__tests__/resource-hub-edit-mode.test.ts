import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

const src = readFileSync(
  join(process.cwd(), "components/interface/blocks/InternalResourceHubBlock.tsx"),
  "utf8"
)

describe("InternalResourceHubBlock edit mode", () => {
  it("does not select preview when isEditing", () => {
    expect(src).toMatch(/handleSelect[\s\S]*?if \(isEditing\) return/)
  })

  it("does not open file URL when isEditing", () => {
    expect(src).toMatch(/openResourceUrl[\s\S]*?if \(isEditing\) return/)
    expect(src).toContain("window.open(url")
  })

  it("does not open Manage asset drawer when isEditing", () => {
    expect(src).toMatch(/handleEditResourceDetails[\s\S]*?if \(isEditing/)
    expect(src).toContain('recordLayoutType: "asset"')
    expect(src).toContain("canManageSelectedResource")
    expect(src).toContain("!isEditing")
  })

  it("preserves view-mode asset drawer path", () => {
    expect(src).toContain("openRecordModal({")
    expect(src).toContain('recordLayoutType: "asset"')
  })

  it("opens Manage asset in edit mode for admin field editing", () => {
    expect(src).toContain('initialDrawerMode: "edit"')
    expect(src).toContain('effectiveRole === "admin"')
  })

  it("opens create resource with asset layout", () => {
    expect(src).toMatch(/handleCreateResource[\s\S]*?recordLayoutType:\s*"asset"/)
  })
})
