import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { BLOCK_REGISTRY } from "@/lib/interface/registry"

const root = join(__dirname, "..")

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8")
}

describe("P2 dead settings cleanup", () => {
  it("does not provision campaigns_open_record_mode in workspace script", () => {
    const src = readSource("scripts/apply-marketing-hub-workspace.cjs")
    expect(src).not.toContain("campaigns_open_record_mode")
  })

  it("does not default campaigns_open_record_mode in registry", () => {
    const defaults = BLOCK_REGISTRY.campaigns_overview?.defaultConfig ?? {}
    expect(defaults).not.toHaveProperty("campaigns_open_record_mode")
  })
})

describe("P2 Resource Hub stub removal", () => {
  const src = readSource("components/interface/blocks/InternalResourceHubBlock.tsx")

  it("does not use mockAction debug stubs", () => {
    expect(src).not.toContain("mockAction")
    expect(src).not.toContain("Filter (stub)")
  })

  it("omits header filter button when category filters are in-panel", () => {
    expect(src).not.toContain("onFilterClick=")
    const header = readSource("components/interface/blocks/internal-resource-hub/HubHeader.tsx")
    expect(header).not.toContain("onFilterClick")
  })

  it("omits list layout View all stub", () => {
    expect(src).not.toMatch(/onViewAll=\{.*mockAction/)
    expect(src).not.toContain('onViewAll={() =>')
  })
})
