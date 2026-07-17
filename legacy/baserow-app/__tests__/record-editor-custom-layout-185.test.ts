import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

/**
 * Guards against React error #185 (maximum update depth) in custom record layouts.
 * See baserow-app/docs/REACT_ERROR_185_INVESTIGATION.md
 */
describe("RecordEditor custom layout — React #185 guards", () => {
  const src = readFileSync(
    join(process.cwd(), "components/records/RecordEditor.tsx"),
    "utf8"
  )

  it("does not reset collapsed sections from an effect keyed on customLayout.sections", () => {
    expect(src).not.toMatch(
      /setCollapsedSections\([\s\S]*?\},\s*\[[^\]]*customLayout\.sections/
    )
    expect(src).toContain("customLayoutCollapseInitSig")
    expect(src).toContain("filteredFieldsIdSig")
  })

  it("still renders activity and comments in review mode after custom fields", () => {
    expect(src).toContain("mode === \"review\" && recordId")
    expect(src).toContain("<RecordActivity")
    expect(src).toContain("<RecordComments")
  })

  it("preserves unsaved draft warning", () => {
    expect(src).toContain("hasDraftToRestore")
    expect(src).toContain("beforeunload")
  })
})
