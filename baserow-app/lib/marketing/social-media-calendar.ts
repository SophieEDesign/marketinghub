/**
 * Social Media Calendar — field resolution, filtering, events, and block settings.
 */

import {
  filterContentItems,
  getQuarterDateRange,
  quarterLabel,
  getCurrentQuarter,
  type ContentPlanningFieldMap,
  type ContentPlanningFilters,
  type ContentPlanningItem,
  type QuarterNum,
} from "@/lib/marketing/content-planning"
import {
  resolveSocialCalendarExtraFields,
  socialCalendarExtraOverridesFromConfig,
} from "@/lib/marketing/block-config-resolver"
import {
  pickFieldName,
  formatDisplayValue,
  choiceLabelsForFieldNames,
  choiceLabelsFromField,
  mergeFilterOptionLists,
} from "@/lib/marketing/field-utils"
import {
  deriveDefaultValuesFromFilters,
  type FilterConfig,
} from "@/lib/interface/filters"
import type { TableField } from "@/types/fields"
import { normalizeHexColor } from "@/lib/field-colors"
import type { FilterTree, FilterGroup, FilterCondition } from "@/lib/filters/canonical-model"
import {
  conditionsToFilterTree,
  flattenFilterTree,
  normalizeFilterTree,
} from "@/lib/filters/canonical-model"
import type { BlockConfig, BlockFilter } from "@/lib/interface/types"
import { resolveSelectFilterStoredValues } from "@/lib/fields/select-options"
import { plainTextFromHtml } from "@/lib/sanitize"
import type { FieldOptions } from "@/types/fields"
import { format, startOfDay } from "date-fns"

export type SocialPlatform =
  | "instagram"
  | "linkedin"
  | "twitter"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "other"

export type SocialWorkflowStatus =
  | "idea"
  | "draft"
  | "needs_review"
  | "approved"
  | "scheduled"
  | "published"
  | "unknown"

export type SocialCalendarViewMode = "month" | "week" | "list" | "feed"

export type ContentScopeMode = "social_only" | "all_content"

export type SocialCalendarMode = "full" | "compact"

export interface SocialCalendarFieldMap extends ContentPlanningFieldMap {
  caption: string | null
  images: string | null
  channels: string | null
  schedule: string | null
  approvalNotes: string | null
  instagram: string | null
  linkedin: string | null
  twitter: string | null
  facebook: string | null
  tiktok: string | null
  postUrl: string | null
}

export interface SocialCalendarItem extends ContentPlanningItem {
  platforms: SocialPlatform[]
  scheduledTime: string | null
  caption: string | null
  captionSnippet: string
  thumbnailUrl: string | null
  mediaUrls: string[]
  hasMedia: boolean
  campaignLabel: string | null
  approvalNotes: string | null
  normalizedStatus: SocialWorkflowStatus
  statusLabel: string | null
  missingMedia: boolean
  needsReview: boolean
  postUrl: string | null
}

export interface SocialCalendarFilters extends ContentPlanningFilters {
  platforms: SocialPlatform[]
  themes: string[]
  owners: string[]
}

export interface SocialCalendarEvent {
  id: string
  title: string
  start: string
  status: string | null
  statusLabel: string | null
  normalizedStatus: SocialWorkflowStatus
  accentColor: string
  backgroundColor: string
  platforms: SocialPlatform[]
  scheduledTime: string | null
  captionSnippet: string
  thumbnailUrl: string | null
  hasMedia: boolean
  missingMedia: boolean
  needsReview: boolean
  postUrl: string | null
}

export interface SocialStatusSummary {
  scheduled: number
  needsReview: number
  drafts: number
  approved: number
  overdue: number
  missingMedia: number
}

export interface SocialMediaCalendarBlockSettings {
  title: string
  subtitle: string
  defaultView: SocialCalendarViewMode
  contentScope: ContentScopeMode
  mode: SocialCalendarMode
  showStatusBar: boolean
  showFilters: boolean
  showToolbar: boolean
  showMediaPreview: boolean
  showApprovalStatus: boolean
  showPlatformIcons: boolean
  maxPosts: number | null
  showPageHeader: boolean
}

type FieldRow = { name: string; type?: string; options?: FieldOptions }

const SOCIAL_TYPE_PATTERN =
  /social|linkedin|instagram|facebook|twitter|x\.com|tiktok|youtube|bluesky/i

// post_type is intentionally excluded — on Social Posts it is a real subtype filter
// (e.g. social_post vs editorial), not redundant scope.
const SOCIAL_TYPE_FIELD_PATTERN = /content[_\s-]*type|^type$/i

export function sourceTableLooksSocial(tableName: string | null | undefined): boolean {
  const name = tableName?.trim().toLowerCase()
  if (!name) return false
  return /social/.test(name) && /(post|media)/.test(name)
}

function shouldStripRedundantSocialTypeFilter(
  field: string,
  value: unknown,
  isSocialTable: boolean,
  existingFields: Set<string>
): boolean {
  const trimmed = field.trim()
  if (!trimmed || !existingFields.has(trimmed)) return false
  if (!isSocialTable) return false
  if (!SOCIAL_TYPE_FIELD_PATTERN.test(trimmed)) return false
  const valueStr = String(value ?? "")
    .trim()
    .toLowerCase()
  return valueStr.includes("social")
}

function sanitizeFilterTreeNode(
  node: FilterCondition | FilterGroup,
  isSocialTable: boolean,
  existingFields: Set<string>
): FilterCondition | FilterGroup | null {
  if ("field_id" in node && "operator" in node) {
    if (
      shouldStripRedundantSocialTypeFilter(
        node.field_id,
        node.value,
        isSocialTable,
        existingFields
      )
    ) {
      return null
    }
    return node
  }

  const children = node.children
    .map((child) => sanitizeFilterTreeNode(child, isSocialTable, existingFields))
    .filter((child): child is FilterCondition | FilterGroup => child != null)

  if (children.length === 0) return null
  return { ...node, children }
}

function sanitizeFilterTree(
  tree: FilterTree,
  isSocialTable: boolean,
  existingFields: Set<string>
): FilterTree {
  if (!tree) return tree
  return sanitizeFilterTreeNode(tree as FilterCondition | FilterGroup, isSocialTable, existingFields)
}

/**
 * Drop redundant content_type filters on dedicated Social Posts tables.
 * post_type scope is applied client-side (see applySocialCalendarScope) so the
 * toolbar "All content" toggle can still load every row.
 */
export function sanitizeSocialCalendarQueryConfig(
  config: BlockConfig | undefined,
  contentFields: Array<{ name: string }>,
  tableName: string | null | undefined
): BlockConfig | undefined {
  if (!config) return config

  const filters = Array.isArray(config.filters) ? config.filters : []
  const filterTree = (config as { filter_tree?: FilterTree }).filter_tree
  if (filters.length === 0 && !filterTree) return config

  const existingFields = new Set(contentFields.map((f) => f.name))
  const isSocialTable = sourceTableLooksSocial(tableName)

  const cleanedFilters = filters.filter((filter) => {
    const field = typeof filter?.field === "string" ? filter.field.trim() : ""
    if (!field || !existingFields.has(field)) return false
    return !shouldStripRedundantSocialTypeFilter(
      field,
      filter?.value,
      isSocialTable,
      existingFields
    )
  }) as BlockFilter[]

  const cleanedTree = filterTree
    ? sanitizeFilterTree(filterTree, isSocialTable, existingFields)
    : undefined

  const filtersChanged = cleanedFilters.length !== filters.length
  const treeChanged = cleanedTree !== filterTree
  if (!filtersChanged && !treeChanged) return config

  const next: BlockConfig = { ...config, filters: cleanedFilters }
  if (filterTree) {
    ;(next as { filter_tree?: FilterTree }).filter_tree = cleanedTree ?? undefined
  }
  return next
}

/** Default post_type label when Social only scope is active on Social Posts. */
export const DEFAULT_SOCIAL_POST_TYPE_SCOPE = "Social Post"

type FieldNameRow = { name: string; id?: string; type?: string; options?: FieldOptions }

export function resolveSocialCalendarTypeFieldName(
  config: BlockConfig | undefined | null,
  fields: FieldNameRow[]
): string | null {
  const id = config?.social_media_calendar_type_field_id?.trim()
  if (id) {
    const byId = fields.find((f) => f.id === id)
    if (byId?.name) return byId.name
  }
  const byName = config?.social_media_calendar_type_field?.trim()
  if (byName) return byName
  return pickFieldName(fields, [/post_type/i, /content_type/i, /^type$/i], null)
}

export function resolveSocialCalendarScopePostType(
  config: BlockConfig | undefined | null,
  fields: FieldNameRow[],
  tableName: string | null | undefined
): string | null {
  if (config?.social_media_calendar_content_scope === "all_content") return null

  const configured = config?.social_media_calendar_scope_post_type?.trim()
  if (configured) return configured

  const typeField = resolveSocialCalendarTypeFieldName(config, fields)
  if (typeField) {
    const flat = Array.isArray(config?.filters) ? config.filters : []
    for (const f of flat) {
      if (f.field === typeField && f.operator === "equal") {
        const v = filterValueAsString(f.value)
        if (v) return v
      }
    }
    const tree = (config as { filter_tree?: FilterTree })?.filter_tree
    const normalized = normalizeFilterTree(tree ?? null)
    if (normalized) {
      for (const c of flattenFilterTree(normalized)) {
        if (c.field_id === typeField && c.operator === "equal") {
          const v = filterValueAsString(c.value)
          if (v) return v
        }
      }
    }
  }

  if (sourceTableLooksSocial(tableName)) {
    return DEFAULT_SOCIAL_POST_TYPE_SCOPE
  }
  return null
}

export function rowMatchesScopePostType(
  row: Record<string, unknown>,
  typeFieldName: string,
  scopeValue: string,
  fieldMeta?: FieldNameRow
): boolean {
  const raw = row[typeFieldName]
  if (raw == null) return false

  const display = formatDisplayValue(raw)
  if (display.toLowerCase() === scopeValue.toLowerCase()) return true

  const storedCandidates = resolveSelectFilterStoredValues(
    scopeValue,
    "single_select",
    fieldMeta?.options
  )
  const rawStr = typeof raw === "string" ? raw.trim() : display.trim()
  if (!rawStr) return false

  return storedCandidates.some(
    (c) => c === rawStr || c.toLowerCase() === rawStr.toLowerCase()
  )
}

function stripTypeFieldScopeFilters(
  config: BlockConfig,
  typeFieldName: string | null
): BlockConfig {
  if (!typeFieldName) return config

  const filters = (Array.isArray(config.filters) ? config.filters : []).filter(
    (f) => f.field !== typeFieldName
  )
  const filterTree = (config as { filter_tree?: FilterTree }).filter_tree
  let nextTree: FilterTree | undefined = filterTree

  if (filterTree) {
    const normalized = normalizeFilterTree(filterTree)
    if (normalized) {
      const remaining = flattenFilterTree(normalized).filter(
        (c) => c.field_id !== typeFieldName
      )
      nextTree =
        remaining.length > 0 ? conditionsToFilterTree(remaining, normalized.operator) : undefined
    }
  }

  const next: BlockConfig = { ...config, filters }
  ;(next as { filter_tree?: FilterTree }).filter_tree = nextTree
  return next
}

/** Query config for live fetch — strips post_type scope (applied client-side for toolbar toggle). */
export function prepareSocialCalendarQueryConfig(
  config: BlockConfig | undefined,
  contentFields: FieldNameRow[],
  tableName: string | null | undefined
): BlockConfig | undefined {
  const sanitized = sanitizeSocialCalendarQueryConfig(config, contentFields, tableName) ?? config
  if (!sanitized) return config

  const typeField = resolveSocialCalendarTypeFieldName(sanitized, contentFields)
  const scopeValue = resolveSocialCalendarScopePostType(sanitized, contentFields, tableName)
  if (!typeField || !scopeValue) return sanitized

  return stripTypeFieldScopeFilters(sanitized, typeField)
}

export function upsertSocialCalendarScopePostType(
  config: BlockConfig,
  fields: FieldNameRow[],
  scopePostType: string | undefined
): Partial<BlockConfig> {
  const typeField = resolveSocialCalendarTypeFieldName(config, fields)
  const withoutScope = typeField ? stripTypeFieldScopeFilters(config, typeField) : config
  const trimmed = scopePostType?.trim()

  if (!trimmed || !typeField) {
    return {
      social_media_calendar_scope_post_type: trimmed || undefined,
      filters: withoutScope.filters,
      filter_tree: (withoutScope as { filter_tree?: FilterTree }).filter_tree,
    }
  }

  const scopeFilter: BlockFilter = {
    field: typeField,
    operator: "equal",
    value: trimmed,
  }
  const otherFilters = (withoutScope.filters || []).filter((f) => f.field !== typeField)
  const filters = [...otherFilters, scopeFilter]
  const filter_tree = conditionsToFilterTree(
    filters.map((f) => ({
      field_id: f.field,
      operator: f.operator as FilterCondition["operator"],
      value: f.value,
    })),
    "AND"
  )

  return {
    social_media_calendar_scope_post_type: trimmed,
    filters,
    filter_tree,
  }
}

export function applySocialCalendarScope(params: {
  items: SocialCalendarItem[]
  contentScope: ContentScopeMode
  config?: BlockConfig | null
  contentFields: FieldNameRow[]
  contentTableFields: FieldNameRow[]
  contentRows: Record<string, unknown>[]
  sourceTableName: string | null | undefined
  contentTypeFieldExists?: boolean
}): SocialCalendarItem[] {
  const {
    items,
    contentScope,
    config,
    contentFields,
    contentTableFields,
    contentRows,
    sourceTableName,
    contentTypeFieldExists = true,
  } = params

  if (contentScope === "all_content") return items

  const typeFieldName = resolveSocialCalendarTypeFieldName(config, contentTableFields)
  const scopeValue = resolveSocialCalendarScopePostType(
    config,
    contentTableFields.length > 0 ? contentTableFields : contentFields,
    sourceTableName
  )

  if (sourceTableLooksSocial(sourceTableName) && typeFieldName && scopeValue) {
    const fieldMeta = contentTableFields.find((f) => f.name === typeFieldName)
    const rowById = new Map(contentRows.map((row) => [String(row.id), row]))
    return items.filter((item) => {
      const row = rowById.get(item.id)
      if (!row) return false
      return rowMatchesScopePostType(row, typeFieldName, scopeValue, fieldMeta)
    })
  }

  return applyContentScope(items, contentScope, contentTypeFieldExists)
}

const PLATFORM_FROM_CHANNEL: Record<string, SocialPlatform> = {
  instagram: "instagram",
  linkedin: "linkedin",
  twitter: "twitter",
  x: "twitter",
  facebook: "facebook",
  tiktok: "tiktok",
  youtube: "youtube",
}

const REVIEW_PATTERN = /needs?\s*review|awaiting\s*review|in\s*review|for\s*review|review/i
const IDEA_PATTERN = /idea|brainstorm|backlog|concept|new/i
const DRAFT_PATTERN = /draft|to\s*do|todo|writing|wip|in\s*progress/i
const APPROVED_PATTERN = /^approved$/i
const SCHEDULED_PATTERN = /schedul|planned|queued|ready/i
const PUBLISHED_PATTERN = /publish|complete|completed|done|live|posted/i

export function isSocialContentType(contentType: string | null): boolean {
  if (!contentType) return false
  return SOCIAL_TYPE_PATTERN.test(contentType)
}

/** Fallback label when schema has no social-like select option. */
export const DEFAULT_SOCIAL_CONTENT_TYPE_LABEL = "Social Media"

function filterValueAsString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === "string") {
    const t = value.trim()
    return t || null
  }
  if (Array.isArray(value) && value.length > 0) {
    return filterValueAsString(value[0])
  }
  return null
}

/**
 * Content type prefilled on "Create post" when scope is social-only.
 * Order: block setting → block filter on type field → first social-like schema option → default label.
 */
export function resolveSocialContentTypeDefault(params: {
  config?: BlockConfig | null
  contentScope: ContentScopeMode
  contentTypeFieldName: string | null
  contentFields: FieldRow[]
}): string | null {
  const { config, contentScope, contentTypeFieldName, contentFields } = params
  if (contentScope !== "social_only" || !contentTypeFieldName) return null

  const configured = config?.social_media_calendar_content_type_default?.trim()
  if (configured) return configured

  const filters = Array.isArray(config?.filters) ? config.filters : []
  for (const f of filters) {
    if (f.field !== contentTypeFieldName) continue
    if (f.operator !== "equal" && f.operator !== "contains") continue
    const v = filterValueAsString(f.value)
    if (v && isSocialContentType(v)) return v
  }

  const fieldMeta = contentFields.find((f) => f.name === contentTypeFieldName)
  if (fieldMeta) {
    for (const label of choiceLabelsFromField(fieldMeta)) {
      if (isSocialContentType(label)) return label
    }
  }

  return DEFAULT_SOCIAL_CONTENT_TYPE_LABEL
}

/**
 * Initial field values for new content rows — block filters first, then social scope type default.
 */
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

export function buildSocialCalendarCreateInitialData(params: {
  config?: BlockConfig | null
  contentScope: ContentScopeMode
  fields: ContentPlanningFieldMap | null
  contentFields: FieldRow[]
  tableFields?: TableField[]
  /** Publish/schedule date from day click (yyyy-MM-dd or Date). */
  scheduleDate?: string | Date | null
}): Record<string, unknown> {
  const { config, contentScope, fields, contentFields, tableFields = [], scheduleDate } = params
  const blockFilters = (Array.isArray(config?.filters) ? config.filters : []) as FilterConfig[]
  const initial: Record<string, unknown> = {
    ...deriveDefaultValuesFromFilters(blockFilters, tableFields),
  }

  const contentTypeField = fields?.contentType ?? null
  if (contentTypeField && initial[contentTypeField] === undefined) {
    const typeDefault = resolveSocialContentTypeDefault({
      config,
      contentScope,
      contentTypeFieldName: contentTypeField,
      contentFields,
    })
    if (typeDefault) initial[contentTypeField] = typeDefault
  }

  const dateField = fields?.contentDate ?? null
  if (dateField && scheduleDate != null) {
    if (typeof scheduleDate === "string" && DATE_ONLY_RE.test(scheduleDate.trim())) {
      initial[dateField] = scheduleDate.trim()
    } else {
      const d =
        typeof scheduleDate === "string"
          ? new Date(`${scheduleDate.trim()}T00:00:00`)
          : scheduleDate
      if (!isNaN(d.getTime())) {
        initial[dateField] = socialCalendarDateFieldValue(d)
      }
    }
  }

  return initial
}

export function resolveSocialCalendarFields(
  contentFields: FieldRow[],
  campaignFields: FieldRow[],
  themeFields: FieldRow[]
): SocialCalendarFieldMap {
  const base = {
    contentName: pickFieldName(contentFields, [/content_name/i, /^name$/i, /title/i], "content_name")!,
    contentDate: pickFieldName(contentFields, [/^date$/i, /publish_date/i], null),
    contentDueDate: pickFieldName(contentFields, [/date_due/i, /due_date/i], null),
    contentStatus: pickFieldName(contentFields, [/^status$/i], null),
    contentType: pickFieldName(contentFields, [/content_type/i, /^type$/i], null),
    contentTheme: pickFieldName(contentFields, [/quarterly_theme/i, /^theme$/i], null),
    contentCampaign: pickFieldName(contentFields, [/campaigns?/i], null),
    contentOwner: pickFieldName(contentFields, [/owner/i, /assignee/i], null),
    contentDivision: pickFieldName(contentFields, [/division/i, /team/i, /department/i], null),
    isArchived: pickFieldName(contentFields, [/^is_archived$/i, /^archived$/i], null),
    deletedAt: pickFieldName(contentFields, [/^deleted_at$/i], null),
    campaignName: pickFieldName(campaignFields, [/^name$/i], "name")!,
    campaignStatus: pickFieldName(campaignFields, [/^status$/i], null),
    campaignContent: pickFieldName(campaignFields, [/^content$/i, /content_link/i], null),
    campaignTheme: pickFieldName(campaignFields, [/quarterly_theme/i, /^theme$/i], null),
    themeName:
      pickFieldName(themeFields, [/^name$/i, /^theme$/i, /theme_name/i, /^title$/i], null) ||
      "theme",
    themeQuarter: pickFieldName(themeFields, [/^quarter$/i, /fiscal_quarter/i], null),
    themeYear: pickFieldName(themeFields, [/^year$/i, /fiscal_year/i], null),
    themeColor: pickFieldName(themeFields, [/theme_colou?r/i, /^colou?r$/i, /accent/i], null),
    themeDivisions: pickFieldName(themeFields, [/lead_divisions/i, /divisions/i], null),
  }

  return {
    ...base,
    caption: pickFieldName(contentFields, [/content_post_text/i, /post_text/i, /caption/i], null),
    images: pickFieldName(contentFields, [/^images$/i, /media/i, /attachment/i], null),
    channels: pickFieldName(contentFields, [/^channels$/i], null),
    schedule: pickFieldName(contentFields, [/^schedule$/i, /post_time/i, /time/i], null),
    approvalNotes: pickFieldName(
      contentFields,
      [/notes_detail/i, /approval_notes/i, /feedback/i],
      null
    ),
    instagram: pickFieldName(contentFields, [/^instagram$/i], null),
    linkedin: pickFieldName(contentFields, [/^linkedin$/i], null),
    twitter: pickFieldName(contentFields, [/^twitter$/i, /^x$/i], null),
    facebook: pickFieldName(contentFields, [/^facebook$/i], null),
    tiktok: pickFieldName(contentFields, [/^tiktok$/i], null),
    postUrl: pickFieldName(
      contentFields,
      [/planable/i, /post_url/i, /post_link/i, /planable_url/i],
      null
    ),
  }
}

export function extendSocialCalendarFieldMap(
  base: ContentPlanningFieldMap,
  contentFields: FieldRow[],
  config?: import("@/lib/interface/types").BlockConfig | null
): SocialCalendarFieldMap {
  const extra = resolveSocialCalendarFields(contentFields, [], [])
  const fieldIds = contentFields.map((f) => ({
    id: (f as { id?: string }).id || f.name,
    name: f.name,
  }))
  const resolved = resolveSocialCalendarExtraFields(
    fieldIds,
    socialCalendarExtraOverridesFromConfig(config ?? undefined)
  )
  const channels =
    resolved.channels ?? resolved.platform ?? extra.channels
  return {
    ...base,
    caption: resolved.caption ?? extra.caption,
    images: resolved.images ?? extra.images,
    channels,
    schedule: extra.schedule,
    approvalNotes: extra.approvalNotes,
    instagram: extra.instagram,
    linkedin: extra.linkedin,
    twitter: extra.twitter,
    facebook: extra.facebook,
    tiktok: extra.tiktok,
    postUrl: resolved.postUrl ?? extra.postUrl,
  }
}

export function socialCalendarSettingsFromConfig(
  config?: BlockConfig | null
): SocialMediaCalendarBlockSettings {
  const c = config || {}
  const view = c.social_media_calendar_default_view
  const validView: SocialCalendarViewMode =
    view === "week" || view === "list" || view === "feed" ? view : "month"
  const scope = c.social_media_calendar_content_scope
  const contentScope: ContentScopeMode =
    scope === "all_content" ? "all_content" : "social_only"

  return {
    title: String(c.title || "Social Media Calendar"),
    subtitle: String(
      c.social_media_calendar_subtitle ||
        "Visual planning for social posts — platforms, media, and approval status at a glance."
    ),
    defaultView: validView,
    contentScope,
    mode: c.social_media_calendar_mode === "compact" ? "compact" : "full",
    showStatusBar: c.social_media_calendar_show_status_bar !== false,
    showFilters: c.social_media_calendar_show_filters !== false,
    showToolbar: c.social_media_calendar_show_toolbar !== false,
    showMediaPreview: c.social_media_calendar_show_media_preview !== false,
    showApprovalStatus: c.social_media_calendar_show_approval_status !== false,
    showPlatformIcons: c.social_media_calendar_show_platform_icons !== false,
    maxPosts:
      typeof c.social_media_calendar_max_posts === "number"
        ? c.social_media_calendar_max_posts
        : null,
    showPageHeader: c.social_media_calendar_show_page_header === true,
  }
}

export const DEFAULT_SOCIAL_MEDIA_CALENDAR_BLOCK_CONFIG: BlockConfig = {
  title: "Social Media Calendar",
  social_media_calendar_subtitle:
    "Visual planning for social posts — platforms, media, and approval status at a glance.",
  social_media_calendar_default_view: "month",
  social_media_calendar_content_scope: "social_only",
  social_media_calendar_scope_post_type: DEFAULT_SOCIAL_POST_TYPE_SCOPE,
  social_media_calendar_content_type_default: DEFAULT_SOCIAL_CONTENT_TYPE_LABEL,
  social_media_calendar_mode: "full",
  social_media_calendar_show_status_bar: true,
  social_media_calendar_show_filters: true,
  social_media_calendar_show_toolbar: true,
  social_media_calendar_show_media_preview: true,
  social_media_calendar_show_approval_status: true,
  social_media_calendar_show_platform_icons: true,
  appearance: { showTitle: true },
}

export function normalizeSocialStatus(status: string | null): SocialWorkflowStatus {
  if (!status || !status.trim()) return "idea"
  const s = status.trim()
  if (PUBLISHED_PATTERN.test(s)) return "published"
  if (SCHEDULED_PATTERN.test(s)) return "scheduled"
  if (APPROVED_PATTERN.test(s)) return "approved"
  if (REVIEW_PATTERN.test(s)) return "needs_review"
  if (DRAFT_PATTERN.test(s)) return "draft"
  if (IDEA_PATTERN.test(s)) return "idea"
  return "unknown"
}

export function socialStatusDisplayLabel(status: SocialWorkflowStatus): string {
  const labels: Record<SocialWorkflowStatus, string> = {
    idea: "Idea",
    draft: "Draft",
    needs_review: "Needs review",
    approved: "Approved",
    scheduled: "Scheduled",
    published: "Published",
    unknown: "Unknown",
  }
  return labels[status]
}

function platformFromString(raw: string): SocialPlatform | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, "")
  if (PLATFORM_FROM_CHANNEL[key]) return PLATFORM_FROM_CHANNEL[key]
  if (/instagram/i.test(raw)) return "instagram"
  if (/linkedin/i.test(raw)) return "linkedin"
  if (/twitter|^x$/i.test(raw)) return "twitter"
  if (/facebook/i.test(raw)) return "facebook"
  if (/tiktok/i.test(raw)) return "tiktok"
  if (/youtube/i.test(raw)) return "youtube"
  return null
}

export function derivePlatforms(params: {
  channels: unknown
  contentType: string | null
  row: Record<string, unknown>
  fields: SocialCalendarFieldMap
}): SocialPlatform[] {
  const { channels, contentType, row, fields } = params
  const found = new Set<SocialPlatform>()

  if (Array.isArray(channels)) {
    for (const ch of channels) {
      const p = platformFromString(String(ch))
      if (p) found.add(p)
    }
  } else if (typeof channels === "string" && channels.trim()) {
    channels.split(/[,;|]/).forEach((part) => {
      const p = platformFromString(part)
      if (p) found.add(p)
    })
  }

  const flagFields: Array<[string | null, SocialPlatform]> = [
    [fields.instagram, "instagram"],
    [fields.linkedin, "linkedin"],
    [fields.twitter, "twitter"],
    [fields.facebook, "facebook"],
    [fields.tiktok, "tiktok"],
  ]

  for (const [fieldName, platform] of flagFields) {
    if (!fieldName) continue
    const v = row[fieldName]
    if (v === true || v === "true" || v === 1 || v === "1" || (typeof v === "string" && v.trim())) {
      found.add(platform)
    }
  }

  const platformCopy = row.platform_copy
  if (platformCopy && typeof platformCopy === "object" && !Array.isArray(platformCopy)) {
    for (const key of Object.keys(platformCopy as Record<string, unknown>)) {
      const p = platformFromString(key)
      if (p) found.add(p)
    }
  }

  if (found.size === 0 && contentType) {
    const p = platformFromString(contentType)
    if (p) found.add(p)
  }

  return Array.from(found)
}

export function parseContentMediaThumbnail(images: unknown): {
  thumbnailUrl: string | null
  mediaUrls: string[]
} {
  const urls: string[] = []

  const pushUrl = (u: unknown) => {
    if (typeof u !== "string" || !u.trim()) return
    const trimmed = u.trim()
    if (trimmed.startsWith("http") || trimmed.startsWith("/") || trimmed.startsWith("data:")) {
      urls.push(trimmed)
    }
  }
  const pushSplitUrls = (raw: string) => {
    raw
      .split(/[\n,;|]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => pushUrl(part))
  }

  if (images == null || images === "") {
    return { thumbnailUrl: null, mediaUrls: [] }
  }

  if (typeof images === "string") {
    const s = images.trim()
    if (s.startsWith("[") || s.startsWith("{")) {
      try {
        return parseContentMediaThumbnail(JSON.parse(s))
      } catch {
        pushSplitUrls(s)
      }
    } else {
      // Support comma/newline-separated URL lists from text fields.
      pushSplitUrls(s)
    }
  } else if (Array.isArray(images)) {
    for (const item of images) {
      if (typeof item === "string") pushUrl(item)
      else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>
        pushUrl(obj.url ?? obj.src ?? obj.href ?? obj.thumbnail ?? obj.file_url)
      }
    }
  } else if (typeof images === "object") {
    const obj = images as Record<string, unknown>
    pushUrl(obj.url ?? obj.src ?? obj.href)
  }

  return { thumbnailUrl: urls[0] ?? null, mediaUrls: urls }
}

function extractLinkedId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (value && typeof value === "object" && "id" in (value as object)) {
    return String((value as { id: string }).id)
  }
  if (Array.isArray(value) && value.length > 0) return extractLinkedId(value[0])
  return null
}

function snippet(text: string, max = 80): string {
  const t = text.replace(/\s+/g, " ").trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function decodeCommonHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

export function normalizeExternalUrl(url: string | null | undefined): string | null {
  if (url == null) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function isPlanableUrl(url: string): boolean {
  return /planable\./i.test(url)
}

export function externalLinkLabel(url: string): string {
  return isPlanableUrl(url) ? "Open in Planable" : "Open post link"
}

function normalizeCaptionText(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""

  // Some sources store escaped HTML (e.g. &lt;p&gt;...&lt;/p&gt;), others store real tags.
  const decoded = decodeCommonHtmlEntities(trimmed)
  const stripped = plainTextFromHtml(decoded)

  // Fallback cleanup for malformed fragments that can survive sanitization.
  return stripped
    .replace(/<\/?p>/gi, " ")
    .replace(/<\/?br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function buildSocialCalendarItems(params: {
  baseItems: ContentPlanningItem[]
  contentRows: Record<string, unknown>[]
  fields: SocialCalendarFieldMap
  campaignLabelById: Map<string, string>
}): SocialCalendarItem[] {
  const { baseItems, contentRows, fields, campaignLabelById } = params
  const rowById = new Map(contentRows.map((r) => [String(r.id), r]))

  return baseItems.map((item) => {
    const row = rowById.get(item.id) ?? {}
    const captionRaw = fields.caption ? formatDisplayValue(row[fields.caption]) : null
    const caption = captionRaw ? normalizeCaptionText(captionRaw) || null : null
    const captionSnippet = snippet(caption || item.title, 72)
    const channels = fields.channels ? row[fields.channels] : null
    const platforms = derivePlatforms({
      channels,
      contentType: item.contentType,
      row,
      fields,
    })
    const scheduleRaw = fields.schedule ? formatDisplayValue(row[fields.schedule]) : null
    const scheduledTime = scheduleRaw?.trim() || null
    const { thumbnailUrl, mediaUrls } = fields.images
      ? parseContentMediaThumbnail(row[fields.images])
      : { thumbnailUrl: null, mediaUrls: [] }
    const hasMedia = mediaUrls.length > 0
    const approvalNotes = fields.approvalNotes
      ? formatDisplayValue(row[fields.approvalNotes])?.trim() || null
      : null
    const postUrl = fields.postUrl
      ? normalizeExternalUrl(formatDisplayValue(row[fields.postUrl]))
      : null

    const campaignId = fields.contentCampaign ? extractLinkedId(row[fields.contentCampaign]) : null
    const campaignLabel = campaignId ? campaignLabelById.get(campaignId) ?? null : null

    const normalizedStatus = normalizeSocialStatus(item.status)
    const needsReview = normalizedStatus === "needs_review"
    const isSocial = isSocialContentType(item.contentType) || platforms.length > 0
    const missingMedia = isSocial && !hasMedia && normalizedStatus !== "published"

    return {
      ...item,
      platforms,
      scheduledTime,
      caption,
      captionSnippet,
      thumbnailUrl,
      mediaUrls,
      hasMedia,
      campaignLabel,
      approvalNotes,
      normalizedStatus,
      statusLabel: item.status,
      missingMedia,
      needsReview,
      postUrl,
    }
  })
}

export function applyContentScope(
  items: SocialCalendarItem[],
  scope: ContentScopeMode,
  /** Pass false when the source table has no content_type field — all items are treated as social. */
  contentTypeFieldExists = true
): SocialCalendarItem[] {
  if (scope === "all_content") return items
  // When the table has no content_type column (e.g. a dedicated social posts table),
  // every row is implicitly social — don't filter them out.
  if (!contentTypeFieldExists) return items
  return items.filter(
    (i) =>
      isSocialContentType(i.contentType) ||
      i.platforms.length > 0 ||
      /social/i.test(i.contentType ?? "")
  )
}

export function filterSocialCalendarItems(
  items: SocialCalendarItem[],
  filters: SocialCalendarFilters
): SocialCalendarItem[] {
  const baseFiltered = filterContentItems<SocialCalendarItem>(items, filters)

  return baseFiltered.filter((item) => {
    if (filters.platforms.length) {
      if (!item.platforms.some((p) => filters.platforms.includes(p))) return false
    }
    if (filters.themes.length && item.themeLabel) {
      if (!filters.themes.includes(item.themeLabel)) return false
    } else if (filters.themes.length && !item.themeLabel) {
      return false
    }
    if (filters.owners.length && item.assignee) {
      if (!filters.owners.includes(item.assignee)) return false
    } else if (filters.owners.length && !item.assignee) {
      return false
    }
    return true
  })
}

export function collectSocialFilterOptions(
  items: SocialCalendarItem[],
  opts?: {
    contentFields?: FieldRow[]
    statusFieldName?: string | null
    typeFieldName?: string | null
  }
): {
  platforms: SocialPlatform[]
  themes: string[]
  owners: string[]
  statuses: string[]
  years: number[]
} {
  const platforms = new Set<SocialPlatform>()
  const themes = new Set<string>()
  const owners = new Set<string>()
  const statuses = new Set<string>()
  const years = new Set<number>()

  for (const item of items) {
    item.platforms.forEach((p) => platforms.add(p))
    if (item.themeLabel) themes.add(item.themeLabel)
    if (item.assignee) owners.add(item.assignee)
    if (item.status) statuses.add(item.status)
    const d = item.date ?? item.dueDate
    if (d) years.add(d.getFullYear())
  }

  // Only fall back to current year when no records expose a date year.
  if (years.size === 0) {
    years.add(new Date().getFullYear())
  }

  const platformOrder: SocialPlatform[] = [
    "instagram",
    "linkedin",
    "twitter",
    "facebook",
    "tiktok",
    "youtube",
    "other",
  ]

  const statusFromSchema = opts?.contentFields?.length
    ? choiceLabelsForFieldNames(opts.contentFields, [opts.statusFieldName])
    : []

  return {
    platforms: platformOrder.filter((p) => platforms.has(p)),
    themes: Array.from(themes).sort(),
    owners: Array.from(owners).sort(),
    statuses: mergeFilterOptionLists(Array.from(statuses), statusFromSchema),
    years: Array.from(years).sort((a, b) => b - a),
  }
}

function softBackground(hex: string): string {
  try {
    return `${normalizeHexColor(hex)}22`
  } catch {
    return "hsl(var(--muted))"
  }
}

export function buildSocialCalendarEvents(items: SocialCalendarItem[]): SocialCalendarEvent[] {
  return items
    .filter((item) => item.date)
    .map((item) => ({
      id: item.id,
      title: item.title,
      start: format(item.date!, "yyyy-MM-dd"),
      status: item.status,
      statusLabel: item.statusLabel,
      normalizedStatus: item.normalizedStatus,
      accentColor: item.accentColor,
      backgroundColor: softBackground(item.accentColor),
      platforms: item.platforms,
      scheduledTime: item.scheduledTime,
      captionSnippet: item.captionSnippet,
      thumbnailUrl: item.thumbnailUrl,
      hasMedia: item.hasMedia,
      missingMedia: item.missingMedia,
      needsReview: item.needsReview,
      postUrl: item.postUrl,
    }))
}

export function buildSocialStatusSummary(items: SocialCalendarItem[]): SocialStatusSummary {
  let scheduled = 0
  let needsReview = 0
  let drafts = 0
  let approved = 0
  let overdue = 0
  let missingMedia = 0

  for (const item of items) {
    if (item.isOverdue) overdue++
    if (item.missingMedia) missingMedia++
    switch (item.normalizedStatus) {
      case "scheduled":
        scheduled++
        break
      case "needs_review":
        needsReview++
        break
      case "draft":
      case "idea":
        drafts++
        break
      case "approved":
        approved++
        break
      default:
        break
    }
  }

  return { scheduled, needsReview, drafts, approved, overdue, missingMedia }
}

/** Value written to the content publish/schedule date field on drag-and-drop. */
export function socialCalendarDateFieldValue(date: Date): string {
  return format(startOfDay(date), "yyyy-MM-dd")
}

export function formatSocialDateTime(item: SocialCalendarItem): string {
  const d = item.date
  if (!d) return "No date"
  const datePart = format(d, "EEE, d MMM yyyy")
  if (item.scheduledTime) return `${datePart} at ${item.scheduledTime}`
  return datePart
}

export { quarterLabel, getQuarterDateRange, getCurrentQuarter, type QuarterNum }
