/**
 * Event Calendar block config — workflow values and field override keys.
 */

import type { BlockConfig } from "@/lib/interface/types"
import type { FieldOverridePair } from "@/lib/marketing/block-config-resolver"
import { overridePair } from "@/lib/marketing/block-config-resolver"
import type { EventFieldMap } from "@/lib/marketing/events"

export interface EventCalendarWorkflowConfig {
  submittedStatus: string
  approvedStatus: string
  rejectedStatus: string
  memberDefaultVisibility: string
  contentTypeDefault: string
}

export function eventCalendarWorkflowFromConfig(
  config?: BlockConfig | Record<string, unknown> | null
): EventCalendarWorkflowConfig {
  const c = config || {}
  return {
    submittedStatus: String(c.event_calendar_submitted_status_value || "Submitted"),
    approvedStatus: String(c.event_calendar_approved_status_value || "Published"),
    rejectedStatus: String(c.event_calendar_rejected_status_value || "Cancelled"),
    memberDefaultVisibility: String(c.event_calendar_member_default_visibility || "members_only"),
    contentTypeDefault: String(c.event_calendar_content_type_default || "Event"),
  }
}

const PENDING_STATUS_PATTERN = /^(submitted|pending|pending approval|pending_approval)$/i

export function isPendingApprovalStatus(status: string | null | undefined): boolean {
  if (!status) return false
  return PENDING_STATUS_PATTERN.test(status.trim())
}

export function eventCalendarOverridesFromConfig(
  config?: BlockConfig
): Partial<Record<keyof EventFieldMap, FieldOverridePair>> {
  const c = config || {}
  return {
    eventName: overridePair(c, "event_calendar_title_field_id", "event_calendar_title_field"),
    eventType: overridePair(
      c,
      "event_calendar_event_type_field_id",
      "event_calendar_event_type_field"
    ),
    startDate: overridePair(
      c,
      "event_calendar_start_date_field_id",
      "event_calendar_start_date_field"
    ),
    endDate: overridePair(c, "event_calendar_end_date_field_id", "event_calendar_end_date_field"),
    allDay: overridePair(c, "event_calendar_all_day_field_id", "event_calendar_all_day_field"),
    startTime: overridePair(
      c,
      "event_calendar_start_time_field_id",
      "event_calendar_start_time_field"
    ),
    endTime: overridePair(c, "event_calendar_end_time_field_id", "event_calendar_end_time_field"),
    timezone: overridePair(c, "event_calendar_timezone_field_id", "event_calendar_timezone_field"),
    status: overridePair(c, "event_calendar_status_field_id", "event_calendar_status_field"),
    visibility: overridePair(
      c,
      "event_calendar_visibility_field_id",
      "event_calendar_visibility_field"
    ),
    location: overridePair(
      c,
      "event_calendar_location_link_field_id",
      "event_calendar_location_link_field"
    ),
    locationName: overridePair(
      c,
      "event_calendar_location_field_id",
      "event_calendar_location_field"
    ),
    city: overridePair(c, "event_calendar_city_field_id", "event_calendar_city_field"),
    country: overridePair(c, "event_calendar_country_field_id", "event_calendar_country_field"),
    venue: overridePair(c, "event_calendar_venue_field_id", "event_calendar_venue_field"),
    website: overridePair(c, "event_calendar_url_field_id", "event_calendar_url_field"),
    description: overridePair(
      c,
      "event_calendar_description_field_id",
      "event_calendar_description_field"
    ),
    heroImage: overridePair(
      c,
      "event_calendar_hero_image_field_id",
      "event_calendar_hero_image_field"
    ),
    linkedTheme: overridePair(c, "event_calendar_theme_field_id", "event_calendar_theme_field"),
    campaign: overridePair(c, "event_calendar_campaign_field_id", "event_calendar_campaign_field"),
    owner: overridePair(c, "event_calendar_owner_field_id", "event_calendar_owner_field"),
    budget: overridePair(c, "event_calendar_budget_field_id", "event_calendar_budget_field"),
    notes: overridePair(c, "event_calendar_notes_field_id", "event_calendar_notes_field"),
    attendees: overridePair(
      c,
      "event_calendar_attending_field_id",
      "event_calendar_attending_field"
    ),
    scheduleItems: overridePair(
      c,
      "event_calendar_schedule_field_id",
      "event_calendar_schedule_field"
    ),
    resources: overridePair(
      c,
      "event_calendar_resources_field_id",
      "event_calendar_resources_field"
    ),
    deletedAt: overridePair(
      c,
      "event_calendar_deleted_at_field_id",
      "event_calendar_deleted_at_field"
    ),
  }
}

export function eventCalendarContentTypeOverride(
  config?: BlockConfig
): FieldOverridePair {
  const c = config || {}
  return overridePair(c, "event_calendar_content_type_field_id", "event_calendar_content_type_field")
}
