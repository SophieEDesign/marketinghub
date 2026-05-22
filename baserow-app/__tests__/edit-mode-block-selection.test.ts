import { describe, it, expect } from "vitest"
import {
  REGISTERED_DATA_BLOCK_TYPES,
  REGISTERED_APPEARANCE_BLOCK_TYPES,
} from "@/components/interface/settings/blockSettingsRegistry"
import { assertBlockConfig } from "@/lib/interface/assertBlockConfig"

const MARKETING_CUSTOM_BLOCK_TYPES = [
  "internal_resource_hub",
  "content_timeline",
  "upcoming_summary",
  "things_to_do",
  "event_calendar",
  "social_media_calendar",
] as const

describe("edit mode — marketing block settings registry", () => {
  it("registers data and appearance settings keys for all marketing custom block types", () => {
    for (const type of MARKETING_CUSTOM_BLOCK_TYPES) {
      expect(REGISTERED_DATA_BLOCK_TYPES).toContain(type)
      expect(REGISTERED_APPEARANCE_BLOCK_TYPES).toContain(type)
    }
  })
})

describe("edit mode — assertBlockConfig allows marketing block config keys", () => {
  it("does not reject custom marketing block types", () => {
    for (const type of MARKETING_CUSTOM_BLOCK_TYPES) {
      const result = assertBlockConfig(type, {
        title: "Hub",
        things_to_do_subtitle: "Subtitle",
        content_timeline_default_view: "month",
        upcoming_summary_max_items: 5,
        resource_hub_layout_mode: "gallery",
        social_media_calendar_default_view: "month",
        event_calendar_show_filters: true,
      })
      expect(result.valid).toBe(true)
    }
  })
})
