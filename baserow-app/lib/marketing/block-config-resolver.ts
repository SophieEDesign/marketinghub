/**
 * Shared Marketing Hub block config resolution (table, fields, demo state).
 */

import type { BlockConfig } from "@/lib/interface/types"
import type { ContentPlanningFieldMap } from "@/lib/marketing/content-planning"
import type { MarketingTableRow } from "@/lib/marketing/marketing-tables"

export const MARKETING_DEMO_BANNER_DEFAULT =
  "Using demo data — select a source table in block settings to connect live data."

export type FieldOverridePair = {
  fieldId?: string
  fieldName?: string
}

export type FieldLike = { id: string; name: string }

export function resolveMarketingTable(
  registry: MarketingTableRow[],
  tableId: string | undefined,
  fallbackFinder: (tables: MarketingTableRow[]) => MarketingTableRow | undefined
): MarketingTableRow | undefined {
  const id = tableId?.trim()
  if (id) {
    return registry.find((t) => t.id === id)
  }
  return fallbackFinder(registry)
}

export function fieldNameFromConfig(
  fields: FieldLike[],
  fieldId?: string,
  fieldName?: string
): string | null {
  const id = fieldId?.trim()
  if (id) {
    const byId = fields.find((f) => f.id === id)
    if (byId?.name) return byId.name
  }
  const name = fieldName?.trim()
  if (name) {
    const byName = fields.find((f) => f.name === name)
    if (byName?.name) return byName.name
    return name
  }
  return null
}

export function applyFieldOverrides<T extends object>(
  baseMap: T,
  overrides: Partial<Record<keyof T, FieldOverridePair | undefined>>,
  fields: FieldLike[]
): T {
  const result = { ...baseMap }
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    const pair = overrides[key]
    if (!pair) continue
    const resolved = fieldNameFromConfig(fields, pair.fieldId, pair.fieldName)
    if (resolved) {
      ;(result as Record<keyof T, string | null>)[key] = resolved
    }
  }
  return result
}

export function overridePair(
  config: BlockConfig | undefined,
  idKey: keyof BlockConfig,
  nameKey?: keyof BlockConfig
): FieldOverridePair {
  const c = config || {}
  return {
    fieldId: c[idKey] as string | undefined,
    fieldName: nameKey ? (c[nameKey] as string | undefined) : undefined,
  }
}

export interface MarketingDemoStateResult {
  useDemoData: boolean
  useLiveData: boolean
  showDemoBanner: boolean
  showEmptyState: boolean
  bannerMessage: string
}

export function marketingDemoState(opts: {
  forceMock?: boolean
  fromLiveData: boolean
  hasTable: boolean
  error?: string | null
}): MarketingDemoStateResult {
  if (opts.forceMock === true) {
    return {
      useDemoData: true,
      useLiveData: false,
      showDemoBanner: true,
      showEmptyState: false,
      bannerMessage: "Using demo data — demo mode is enabled in block settings.",
    }
  }
  if (opts.fromLiveData) {
    return {
      useDemoData: false,
      useLiveData: true,
      showDemoBanner: false,
      showEmptyState: false,
      bannerMessage: "",
    }
  }
  if (opts.hasTable) {
    return {
      useDemoData: false,
      useLiveData: false,
      showDemoBanner: false,
      showEmptyState: true,
      bannerMessage: opts.error || "Could not load data from the selected table.",
    }
  }
  return {
    useDemoData: false,
    useLiveData: false,
    showDemoBanner: false,
    showEmptyState: true,
    bannerMessage:
      opts.error ||
      "Select a source table in block settings to connect live data.",
  }
}

export function isMarketingMockEnabled(
  config: BlockConfig | undefined,
  mockKey: keyof BlockConfig,
  legacyKey?: keyof BlockConfig
): boolean {
  const c = config || {}
  if (c[mockKey] === true) return true
  if (legacyKey && c[legacyKey] === true) return true
  return false
}

/** Content timeline / things-to-do / social field overrides on ContentPlanningFieldMap keys. */
export function contentPlanningOverridesFromConfig(
  config: BlockConfig | undefined,
  prefix: "content_timeline" | "things_to_do" | "social_media_calendar"
): Partial<Record<keyof ContentPlanningFieldMap, FieldOverridePair>> {
  const c = config || {}
  const p = prefix
  return {
    contentName: overridePair(c, `${p}_title_field_id` as keyof BlockConfig, `${p}_title_field` as keyof BlockConfig),
    contentType: overridePair(c, `${p}_type_field_id` as keyof BlockConfig, `${p}_type_field` as keyof BlockConfig),
    contentStatus: overridePair(c, `${p}_status_field_id` as keyof BlockConfig, `${p}_status_field` as keyof BlockConfig),
    contentTheme: overridePair(c, `${p}_theme_field_id` as keyof BlockConfig, `${p}_theme_field` as keyof BlockConfig),
    contentCampaign: overridePair(c, `${p}_campaign_field_id` as keyof BlockConfig, `${p}_campaign_field` as keyof BlockConfig),
    contentOwner: overridePair(c, `${p}_owner_field_id` as keyof BlockConfig, `${p}_owner_field` as keyof BlockConfig),
    contentDate:
      prefix === "social_media_calendar"
        ? overridePair(
            c,
            "social_media_calendar_publish_date_field_id",
            "social_media_calendar_publish_date_field"
          )
        : overridePair(
            c,
            `${p}_start_date_field_id` as keyof BlockConfig,
            `${p}_start_date_field` as keyof BlockConfig
          ),
    contentDueDate: overridePair(
      c,
      `${p}_end_date_field_id` as keyof BlockConfig,
      `${p}_end_date_field` as keyof BlockConfig
    ),
  }
}

export function contentTimelineOverridesFromConfig(
  config?: BlockConfig
): Partial<Record<keyof ContentPlanningFieldMap, FieldOverridePair>> {
  const c = config || {}
  return {
    ...contentPlanningOverridesFromConfig(c, "content_timeline"),
    contentTheme: overridePair(c, "content_timeline_theme_field_id", "content_timeline_theme_field"),
    contentType: overridePair(c, "content_timeline_type_field_id", "content_timeline_type_field"),
  }
}

export function resourceHubOverridesFromConfig(
  config?: BlockConfig
): Partial<
  Record<
    "name" | "notes" | "status" | "documentLink" | "assignee" | "updatedAt",
    FieldOverridePair
  >
> {
  const c = config || {}
  return {
    name: overridePair(c, "resource_hub_title_field_id", "resource_hub_title_field"),
    notes: overridePair(c, "resource_hub_description_field_id", "resource_hub_description_field"),
    status: overridePair(c, "resource_hub_category_field_id", "resource_hub_category_field"),
    documentLink: overridePair(c, "resource_hub_file_url_field_id", "resource_hub_file_url_field"),
    assignee: overridePair(c, "resource_hub_uploaded_by_field_id", "resource_hub_uploaded_by_field"),
    updatedAt: overridePair(c, "resource_hub_updated_at_field_id", "resource_hub_updated_at_field"),
  }
}

export function eventCalendarOverridesFromConfig(
  config?: BlockConfig
): Partial<
  Record<
    | "eventName"
    | "startDate"
    | "endDate"
    | "eventType"
    | "status"
    | "locationName"
    | "country"
    | "campaign"
    | "attendees"
    | "resources",
    FieldOverridePair
  >
> {
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
    status: overridePair(c, "event_calendar_status_field_id", "event_calendar_status_field"),
    locationName: overridePair(
      c,
      "event_calendar_location_field_id",
      "event_calendar_location_field"
    ),
    country: overridePair(c, "event_calendar_country_field_id", "event_calendar_country_field"),
    campaign: overridePair(c, "event_calendar_campaign_field_id", "event_calendar_campaign_field"),
    attendees: overridePair(
      c,
      "event_calendar_attending_field_id",
      "event_calendar_attending_field"
    ),
    resources: overridePair(
      c,
      "event_calendar_resources_field_id",
      "event_calendar_resources_field"
    ),
  }
}
