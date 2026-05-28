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
import { pickFieldName, formatDisplayValue } from "@/lib/marketing/field-utils"
import { normalizeHexColor } from "@/lib/field-colors"
import type { BlockConfig } from "@/lib/interface/types"
import { plainTextFromHtml } from "@/lib/sanitize"
import type { FieldOptions } from "@/types/fields"
import { format } from "date-fns"

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
  }
}

export function extendSocialCalendarFieldMap(
  base: ContentPlanningFieldMap,
  contentFields: FieldRow[]
): SocialCalendarFieldMap {
  const extra = resolveSocialCalendarFields(contentFields, [], [])
  return {
    ...base,
    caption: extra.caption,
    images: extra.images,
    channels: extra.channels,
    schedule: extra.schedule,
    approvalNotes: extra.approvalNotes,
    instagram: extra.instagram,
    linkedin: extra.linkedin,
    twitter: extra.twitter,
    facebook: extra.facebook,
    tiktok: extra.tiktok,
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

  if (found.size === 0 && contentType) {
    const p = platformFromString(contentType)
    if (p) found.add(p)
    else if (isSocialContentType(contentType)) found.add("other")
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

  if (images == null || images === "") {
    return { thumbnailUrl: null, mediaUrls: [] }
  }

  if (typeof images === "string") {
    const s = images.trim()
    if (s.startsWith("[") || s.startsWith("{")) {
      try {
        return parseContentMediaThumbnail(JSON.parse(s))
      } catch {
        pushUrl(s)
      }
    } else {
      pushUrl(s)
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
    }
  })
}

export function applyContentScope(
  items: SocialCalendarItem[],
  scope: ContentScopeMode
): SocialCalendarItem[] {
  if (scope === "all_content") return items
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

export function collectSocialFilterOptions(items: SocialCalendarItem[]): {
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
  years.add(new Date().getFullYear())

  for (const item of items) {
    item.platforms.forEach((p) => platforms.add(p))
    if (item.themeLabel) themes.add(item.themeLabel)
    if (item.assignee) owners.add(item.assignee)
    if (item.status) statuses.add(item.status)
    const d = item.date ?? item.dueDate
    if (d) years.add(d.getFullYear())
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

  return {
    platforms: platformOrder.filter((p) => platforms.has(p)),
    themes: Array.from(themes).sort(),
    owners: Array.from(owners).sort(),
    statuses: Array.from(statuses).sort(),
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

export function formatSocialDateTime(item: SocialCalendarItem): string {
  const d = item.date
  if (!d) return "No date"
  const datePart = format(d, "EEE, d MMM yyyy")
  if (item.scheduledTime) return `${datePart} at ${item.scheduledTime}`
  return datePart
}

export { quarterLabel, getQuarterDateRange, getCurrentQuarter, type QuarterNum }
