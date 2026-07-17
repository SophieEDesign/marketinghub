import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

describe("Things To Do layout updates", () => {
  it("keeps list as the focused primary view and moves soon views into a compact dropdown", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/things-to-do/ThingsToDoViewTabs.tsx"),
      "utf8"
    )

    expect(src).toContain("View:")
    expect(src).toContain("TABS.filter((tab) => tab.value !== \"list\")")
    expect(src).toContain("disabled")
  })

  it("keeps list-only layout and protects edit-mode interactions", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/blocks/ThingsToDoBlock.tsx"),
      "utf8"
    )

    expect(src).not.toContain("Select a task to view details")
    expect(src).toContain("if (isEditing) return")
    expect(src).toContain("desktopFiltersCollapsed")
  })

  it("uses compact card-style queue rows instead of stretched table rows", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/things-to-do/ThingsToDoRow.tsx"),
      "utf8"
    )

    expect(src).toContain("rounded-xl border border-border/50 bg-background p-3")
    expect(src).toContain("line-clamp-1")
    expect(src).toContain("<ThingsToDoStatusBadge status={item.status} />")
  })

  it("keeps a lighter, narrower filter rail", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/things-to-do/ThingsToDoFilterSidebar.tsx"),
      "utf8"
    )

    expect(src).toContain("lg:w-[196px]")
    expect(src).toContain("bg-muted/10")
  })
})
