/**
 * P0/P1 stabilisation pass (June 2026) — static contract tests.
 */

import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

const root = join(__dirname, "..")

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8")
}

describe("P0 overlay sidebar offset (REG-004)", () => {
  const overlayFiles = [
    "components/records/RecordPanel.tsx",
    "components/interface/EventDetailPanel.tsx",
    "components/interface/EventMemberSubmissionSheet.tsx",
  ]

  it.each(overlayFiles)("uses md:left-sidebar in %s", (file) => {
    const src = readSource(file)
    expect(src).toContain("md:left-sidebar")
    expect(src).not.toMatch(/md:left-64\b/)
  })

  it("RecordPanel excludes right settings panel from backdrop in edit mode", () => {
    const src = readSource("components/records/RecordPanel.tsx")
    expect(src).toContain("md:right-right-settings")
    expect(src).toContain("offsetForRightSettings")
  })

  it("dialog overlay uses md:left-sidebar", () => {
    const src = readSource("components/ui/dialog.tsx")
    expect(src).toContain("md:left-sidebar")
  })
})

describe("P1 navigation — no blank flash on route change", () => {
  it("InterfacePageClient does not clear blocks to [] on route pageId change", () => {
    const src = readSource("components/interface/InterfacePageClient.tsx")
    const navEffect = src.slice(
      src.indexOf("previousRoutePageIdRef.current !== pageId"),
      src.indexOf("previousRoutePageIdRef.current = pageId") + 40
    )
    expect(navEffect).not.toContain("setBlocks([])")
    expect(navEffect).toContain("setBlocksLoading(true)")
  })

  it("tracks blocks page id for stale-while-navigate", () => {
    const src = readSource("components/interface/InterfacePageClient.tsx")
    expect(src).toContain("blocksPageIdRef")
    expect(src).toContain("blocksAreStaleFromOtherPage")
  })
})

describe("P1 block state drift (REG-005)", () => {
  it("loadBlocks skips setBlocks when blocksDirty and forceReload", () => {
    const src = readSource("components/interface/InterfacePageClient.tsx")
    expect(src).toContain("blocksDirty && forceReload")
    expect(src).toContain("Skipping setBlocks - blocks dirty")
  })

  it("documents builder mirror ownership", () => {
    const src = readSource("components/interface/InterfacePageClient.tsx")
    expect(src).toContain("REG-005")
    expect(src).toContain("onBlocksMirror")
  })
})

describe("P1 accessibility quick wins", () => {
  it("LoadingSpinner exposes status role and live region", () => {
    const src = readSource("components/ui/LoadingSpinner.tsx")
    expect(src).toContain('role="status"')
    expect(src).toContain('aria-live="polite"')
    expect(src).toContain('aria-busy="true"')
  })

  it("WorkspaceShell provides skip link to main content", () => {
    const src = readSource("components/layout/WorkspaceShell.tsx")
    expect(src).toContain("Skip to main content")
    expect(src).toContain('id="main-content"')
    expect(src).toContain('href="#main-content"')
  })

  it("ThingsToDoRow supports keyboard activation", () => {
    const src = readSource("components/interface/things-to-do/ThingsToDoRow.tsx")
    expect(src).toContain('role="button"')
    expect(src).toContain("tabIndex={0}")
    expect(src).toContain('e.key === "Enter"')
  })
})

describe("P1 error/loading consistency", () => {
  it("InterfacePageClient uses ErrorState for block load failures", () => {
    const src = readSource("components/interface/InterfacePageClient.tsx")
    expect(src).toContain("blocksLoadError")
    expect(src).toContain("ErrorState")
  })
})

describe("P1 performance cleanup", () => {
  it("InterfaceBuilder does not import unused usePageAggregates", () => {
    const src = readSource("components/interface/InterfaceBuilder.tsx")
    expect(src).not.toContain("usePageAggregates")
  })

  it("InternalResourceHubBlock is dynamically imported", () => {
    const src = readSource("components/interface/BlockRenderer.tsx")
    expect(src).toContain('dynamic(() => import("./blocks/InternalResourceHubBlock")')
    expect(src).not.toMatch(
      /^import InternalResourceHubBlock from/m
    )
  })
})
