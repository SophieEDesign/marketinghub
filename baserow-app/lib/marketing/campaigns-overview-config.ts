/**
 * Campaigns Overview block — field override keys and resolution.
 */

import type { BlockConfig } from "@/lib/interface/types"
import {
  applyFieldOverrides,
  fieldNameFromConfig,
  type FieldLike,
  type FieldOverridePair,
} from "@/lib/marketing/block-config-resolver"

export interface CampaignOverviewFieldMap {
  title: string
  type: string | null
  division: string | null
  status: string | null
  priority: string | null
  stage: string | null
  startDate: string | null
  endDate: string | null
  owner: string | null
  progress: string | null
  image: string | null
  linkedContent: string | null
  linkedTasks: string | null
  linkedEvents: string | null
}

function pickFieldName(
  fields: FieldLike[],
  exact: string[],
  includes: string[]
): string | null {
  for (const name of exact) {
    const hit = fields.find((f) => f.name.toLowerCase() === name)
    if (hit) return hit.name
  }
  for (const needle of includes) {
    const hit = fields.find((f) => f.name.toLowerCase().includes(needle))
    if (hit) return hit.name
  }
  return null
}

function legacyFieldPair(
  config: BlockConfig | undefined,
  idKey: keyof BlockConfig,
  nameKey: keyof BlockConfig,
  legacyIdKey: keyof BlockConfig,
  legacyNameKey: keyof BlockConfig
): FieldOverridePair {
  const c = config || {}
  const fieldId = (c[idKey] as string | undefined) || (c[legacyIdKey] as string | undefined)
  const fieldName =
    (nameKey ? (c[nameKey] as string | undefined) : undefined) ||
    (c[legacyNameKey] as string | undefined)
  return { fieldId, fieldName }
}

export function campaignsOverviewOverridesFromConfig(
  config?: BlockConfig
): Partial<Record<keyof CampaignOverviewFieldMap, FieldOverridePair>> {
  const c = config || {}
  return {
    title: legacyFieldPair(
      c,
      "campaigns_title_field_id",
      "campaigns_title_field",
      "title_field_id",
      "title_field"
    ),
    type: legacyFieldPair(
      c,
      "campaigns_type_field_id",
      "campaigns_type_field",
      "type_field_id",
      "type_field"
    ),
    division: legacyFieldPair(
      c,
      "campaigns_division_field_id",
      "campaigns_division_field",
      "division_field_id",
      "division_field"
    ),
    status: legacyFieldPair(
      c,
      "campaigns_status_field_id",
      "campaigns_status_field",
      "status_field_id",
      "status_field"
    ),
    priority: legacyFieldPair(
      c,
      "campaigns_priority_field_id",
      "campaigns_priority_field",
      "priority_field_id",
      "priority_field"
    ),
    stage: legacyFieldPair(
      c,
      "campaigns_stage_field_id",
      "campaigns_stage_field",
      "stage_field_id",
      "stage_field"
    ),
    startDate: legacyFieldPair(
      c,
      "campaigns_start_date_field_id",
      "campaigns_start_date_field",
      "start_date_field_id",
      "start_date_field"
    ),
    endDate: legacyFieldPair(
      c,
      "campaigns_end_date_field_id",
      "campaigns_end_date_field",
      "end_date_field_id",
      "end_date_field"
    ),
    owner: legacyFieldPair(
      c,
      "campaigns_owner_field_id",
      "campaigns_owner_field",
      "owner_field_id",
      "owner_field"
    ),
    progress: legacyFieldPair(
      c,
      "campaigns_progress_field_id",
      "campaigns_progress_field",
      "progress_field_id",
      "progress_field"
    ),
    image: legacyFieldPair(
      c,
      "campaigns_image_field_id",
      "campaigns_image_field",
      "image_field_id",
      "image_field"
    ),
    linkedContent: legacyFieldPair(
      c,
      "campaigns_linked_content_field_id",
      "campaigns_linked_content_field",
      "linked_content_field_id",
      "linked_content_field"
    ),
    linkedTasks: legacyFieldPair(
      c,
      "campaigns_linked_tasks_field_id",
      "campaigns_linked_tasks_field",
      "linked_tasks_field_id",
      "linked_tasks_field"
    ),
    linkedEvents: legacyFieldPair(
      c,
      "campaigns_linked_events_field_id",
      "campaigns_linked_events_field",
      "linked_events_field_id",
      "linked_events_field"
    ),
  }
}

export function resolveCampaignOverviewFields(
  fields: FieldLike[],
  overrides?: Partial<Record<keyof CampaignOverviewFieldMap, FieldOverridePair>>
): CampaignOverviewFieldMap {
  const base: CampaignOverviewFieldMap = {
    title:
      pickFieldName(fields, ["campaign_name", "name", "title"], ["campaign", "name"]) || "name",
    type: pickFieldName(fields, ["campaign_type", "type"], ["type"]),
    division: pickFieldName(fields, ["division"], ["division"]),
    status: pickFieldName(fields, ["status", "campaign_status"], ["status", "state"]),
    priority: pickFieldName(fields, ["priority"], ["priority"]),
    stage: pickFieldName(fields, ["campaign_stage", "stage"], ["stage"]),
    startDate: pickFieldName(fields, ["start_date"], ["start"]),
    endDate: pickFieldName(fields, ["end_date"], ["end"]),
    owner: pickFieldName(fields, ["owner", "assignee"], ["owner", "assignee"]),
    progress: pickFieldName(fields, ["progress"], ["progress"]),
    image: pickFieldName(fields, ["image", "thumbnail"], ["image", "thumb"]),
    linkedContent: pickFieldName(fields, ["linked_content", "content"], ["content"]),
    linkedTasks: pickFieldName(fields, ["linked_tasks", "things_to_do"], ["task"]),
    linkedEvents: pickFieldName(fields, ["linked_events"], ["event"]),
  }

  if (!overrides || Object.keys(overrides).length === 0) {
    return base
  }

  return applyFieldOverrides(base, overrides, fields)
}

export function campaignsOverviewSubtitle(config?: BlockConfig): string {
  return (
    config?.subtitle ||
    (config as BlockConfig | undefined)?.campaigns_subtitle ||
    "Plan, manage and track all marketing campaigns."
  )
}

export function campaignsOverviewMaxItems(config?: BlockConfig): number {
  const fromBlock = config?.campaigns_max_items ?? config?.record_limit
  if (typeof fromBlock === "number" && Number.isFinite(fromBlock)) {
    return Math.max(0, fromBlock)
  }
  return 200
}

/** Resolve a single field with canonical + legacy config keys (for migrations/tests). */
export function campaignsFieldNameFromConfig(
  fields: FieldLike[],
  config: BlockConfig | undefined,
  idKey: keyof BlockConfig,
  nameKey: keyof BlockConfig,
  legacyIdKey: keyof BlockConfig,
  legacyNameKey: keyof BlockConfig
): string | null {
  const pair = legacyFieldPair(config, idKey, nameKey, legacyIdKey, legacyNameKey)
  return fieldNameFromConfig(fields, pair.fieldId, pair.fieldName)
}
