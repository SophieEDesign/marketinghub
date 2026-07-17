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

describe("MembersWelcomeBlock settings-driven copy", () => {
  it("reads hero copy from config via membersWelcomeCopy", () => {
    expect(src).toContain("membersWelcomeCopy(config)")
    expect(src).toContain("heroTitle")
    expect(src).toContain("{copy.subtitle}")
    expect(src).toContain("{copy.body}")
  })

  it("settings panel exposes heading and data source fields", () => {
    const settings = readFileSync(
      join(process.cwd(), "components/interface/settings/MembersWelcomeDataSettings.tsx"),
      "utf8"
    )
    expect(settings).toContain("members_welcome_title")
    expect(settings).toContain("members_welcome_events_table_id")
    expect(settings).toContain("members_welcome_resources_table_id")
  })
})

describe("MembersWelcomeBlock edit mode", () => {
  it("does not navigate via quick action links when isEditing", () => {
    expect(src).toContain("isEditing={isEditing}")
    expect(src).toContain("QuickActionCard")
  })

  it("does not update RSVP when isEditing", () => {
    expect(src).toMatch(/handleRsvp[\s\S]*?if \(isEditing\)/)
  })

  it("does not open event drawer when isEditing", () => {
    expect(src).toMatch(/openEvent[\s\S]*?if \(isEditing/)
  })

  it("does not open resource URLs when isEditing", () => {
    expect(src).toMatch(/openResource[\s\S]*?if \(isEditing/)
  })

  it("does not navigate guidance help link when isEditing", () => {
    expect(src).toContain("links.help && !isEditing")
  })
})
