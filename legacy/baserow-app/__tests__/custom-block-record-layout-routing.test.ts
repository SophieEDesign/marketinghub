import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

function read(filePath: string) {
  return readFileSync(join(process.cwd(), filePath), "utf8")
}

describe("custom block record layout routing", () => {
  it("uses generic record panel from Social calendar (standard field modal)", () => {
    const src = read("components/interface/SocialMediaCalendarCore.tsx")
    expect(src).toContain('recordLayoutType: "generic"')
    expect(src).toContain("openPost(")
    expect(src).toContain("openRecord(")
    expect(src).not.toContain('recordLayoutType: "social_post"')
  })

  it("passes event layout type from Event calendar", () => {
    const src = read("components/interface/EventCalendarCore.tsx")
    expect(src).toContain('recordLayoutType: "event"')
  })

  it("passes task/campaign/content layout types from custom blocks", () => {
    const things = read("components/interface/blocks/ThingsToDoBlock.tsx")
    const campaigns = read("components/interface/blocks/CampaignsOverviewBlock.tsx")
    const content = read("components/interface/blocks/ContentTimelineBlock.tsx")
    expect(things).toContain('recordLayoutType: "task"')
    expect(campaigns).toContain('recordLayoutType: "campaign"')
    expect(content).toContain('recordLayoutType: "content"')
  })

  it("keeps Resource Hub primary URL open and adds secondary manage action", () => {
    const src = read("components/interface/blocks/InternalResourceHubBlock.tsx")
    const detail = read("components/interface/blocks/internal-resource-hub/DetailPanel.tsx")
    expect(src).toMatch(/window\.open\((url|displayResource\.url)/)
    expect(src).toContain('recordLayoutType: "asset"')
    expect(detail).toContain("Manage asset")
  })

  it("passes contextual recordLayoutType from Upcoming Summary", () => {
    const upcoming = read("components/interface/blocks/UpcomingSummaryBlock.tsx")
    expect(upcoming).toContain("resolveUpcomingSummaryRecordLayoutType")
    expect(upcoming).toContain("recordLayoutType")
  })
})
