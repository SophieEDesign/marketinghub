import type { RecordLayoutType } from "@/lib/records/record-layout-presets"

/**
 * Canonical record layout types for Marketing Hub custom blocks.
 * All marketing block record opens should use RecordPanelContext.openRecord
 * with one of these layout types (never a second drawer/modal).
 */
export const MARKETING_BLOCK_RECORD_LAYOUT: Partial<
  Record<string, RecordLayoutType>
> = {
  social_calendar: "social_post",
  social_media_calendar: "social_post",
  event_calendar: "event",
  things_to_do: "task",
  campaigns_overview: "campaign",
  content_timeline: "content",
  internal_resource_hub: "asset",
}

export function recordLayoutForMarketingBlock(
  blockType: string
): RecordLayoutType | undefined {
  return MARKETING_BLOCK_RECORD_LAYOUT[blockType]
}
