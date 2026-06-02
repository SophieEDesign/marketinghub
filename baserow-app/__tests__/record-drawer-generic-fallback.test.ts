import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

describe("generic record drawer fallback", () => {
  it("keeps generic Grid/List/Calendar open paths unchanged", () => {
    const grid = readFileSync(join(process.cwd(), "components/grid/GridView.tsx"), "utf8")
    const list = readFileSync(join(process.cwd(), "components/views/ListView.tsx"), "utf8")
    const calendar = readFileSync(join(process.cwd(), "components/views/CalendarView.tsx"), "utf8")
    expect(grid).not.toContain("recordLayoutType")
    expect(list).not.toContain("recordLayoutType")
    expect(calendar).not.toContain("recordLayoutType")
  })
})
