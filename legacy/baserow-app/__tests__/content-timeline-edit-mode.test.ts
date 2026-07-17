import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

const src = readFileSync(
  join(process.cwd(), "components/interface/blocks/ContentTimelineBlock.tsx"),
  "utf8"
)

describe("ContentTimelineBlock edit mode", () => {
  it("does not open record drawer when isEditing", () => {
    expect(src).toMatch(/handleOpenRecord[\s\S]*?if \(isEditing\) return/)
  })

  it("does not select items or open records when isEditing", () => {
    expect(src).toMatch(/handleSelectItem[\s\S]*?if \(isEditing\) return/)
  })

  it("does not add content via record modal when isEditing", () => {
    expect(src).toMatch(/handleAddContent[\s\S]*?if \(isEditing\) return/)
  })

  it("preserves view-mode content record layout", () => {
    expect(src).toContain('recordLayoutType: "content"')
    expect(src).toContain("openRecordModal({")
  })
})
