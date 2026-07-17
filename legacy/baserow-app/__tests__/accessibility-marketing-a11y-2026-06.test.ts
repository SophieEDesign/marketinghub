import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = join(__dirname, "..")

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("Accessibility pass — record drawer focus", () => {
  it("RecordPanel uses overlay focus trap and dialog semantics", () => {
    const src = readSource("components/records/RecordPanel.tsx")
    expect(src).toContain("useOverlayPanelA11y")
    expect(src).toContain('role={overlayA11yActive ? "dialog" : undefined}')
    expect(src).toContain("aria-modal={overlayA11yActive ? true : undefined}")
    expect(src).toContain("panelRef")
    expect(src).toContain('aria-label="Close record"')
  })

  it("focus utils and overlay hook are shared", () => {
    expect(readSource("lib/a11y/focus-utils.ts")).toContain("FOCUSABLE_SELECTOR")
    expect(readSource("hooks/useOverlayPanelA11y.ts")).toContain("getFocusableElements")
  })
})

describe("Accessibility pass — grid keyboard", () => {
  it("AirtableGridView group headers are keyboard buttons", () => {
    const src = readSource("components/grid/AirtableGridView.tsx")
    expect(src).toContain("aria-expanded={!isCollapsed}")
    expect(src).toContain('aria-label={`${ruleLabel}: ${node.label}')
  })

  it("AirtableGridView row numbers open records via button", () => {
    const src = readSource("components/grid/AirtableGridView.tsx")
    expect(src).toContain("Open record, row")
    expect(src).toContain('aria-label="Add record"')
  })
})

describe("Accessibility pass — marketing filter live regions", () => {
  it("FilterResultsAnnouncer exposes polite status", () => {
    const src = readSource("components/a11y/FilterResultsAnnouncer.tsx")
    expect(src).toContain('role="status"')
    expect(src).toContain('aria-live="polite"')
    expect(src).toContain("aria-atomic")
  })

  const blocksWithAnnouncer = [
    ["CampaignsOverviewBlock.tsx", "campaigns"],
    ["ContentTimelineBlock.tsx", "timeline items"],
    ["ThingsToDoBlock.tsx", "tasks"],
    ["InternalResourceHubBlock.tsx", "resources"],
    ["ContentThemeBlock.tsx", "themes"],
  ] as const

  it.each(blocksWithAnnouncer)(
    "%s announces filtered counts",
    (file, noun) => {
      const src = readSource(`components/interface/blocks/${file}`)
      expect(src).toContain("FilterResultsAnnouncer")
      expect(src).toContain(`noun="${noun}"`)
    }
  )
})
