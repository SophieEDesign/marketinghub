import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { isMarketingHubWorkspacePage } from "@/lib/marketing/marketing-home"

const src = readFileSync(
  join(process.cwd(), "components/interface/blocks/MembersWelcomeBlock.tsx"),
  "utf8"
)

describe("Members Welcome workspace shell", () => {
  it("is recognized as a Marketing Hub workspace page", () => {
    expect(isMarketingHubWorkspacePage({ name: "Members Welcome" })).toBe(true)
  })
})

describe("MembersWelcomeBlock edit mode", () => {
  it("does not navigate via quick action links when isEditing", () => {
    expect(src).toContain("if (!action.href || isEditing)")
    expect(src).toContain("<QuickActionCard key={action.id} action={action} isEditing={isEditing} />")
  })

  it("does not open event drawer when isEditing", () => {
    expect(src).toMatch(/openEvent[\s\S]*?if \(isEditing/)
  })

  it("does not open resource URLs when isEditing", () => {
    expect(src).toMatch(/openResource[\s\S]*?if \(isEditing/)
  })
})
