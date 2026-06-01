/**
 * Event Calendar — field resolution, filtering, FullCalendar events, metrics.
 */

import {
  applyFieldOverrides,
  fieldNameFromConfig,
  type FieldOverridePair,
} from "@/lib/marketing/block-config-resolver"
import { isPendingApprovalStatus } from "@/lib/marketing/event-calendar-config"
import { formatDisplayValue, pickFieldName } from "@/lib/marketing/field-utils"
import { normalizeHexColor } from "@/lib/field-colors"
import type { FieldOptions } from "@/types/fields"
import {
  addDays,
  addMonths,
  differenceInDays,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns"

export type EventCalendarViewMode = "month" | "week" | "list" | "timeline"

export const EVENT_TYPES = [
  "Boat Show",
  "Racing / Sport",
  "Experience / Events",
  "Hospitality",
  "International",
  "Other",
] as const

export const EVENT_STATUSES = [
  "Idea",
  "Planning",
  "Confirmed",
  "Attending",
  "Completed",
  "Cancelled",
] as const

export type EventTypeLabel = (typeof EVENT_TYPES)[number] | string
export type EventStatusLabel = (typeof EVENT_STATUSES)[number] | string

const EVENT_TYPE_COLORS: Record<string, string> = {
  "boat show": "#3B82F6",
  exhibition: "#10B981",
  conference: "#3B82F6",
  "racing / sport": "#8B5CF6",
  racing: "#8B5CF6",
  sport: "#8B5CF6",
  "experience / events": "#8B5CF6",
  experience: "#8B5CF6",
  hospitality: "#F97316",
  sponsorship: "#EC4899",
  internal: "#64748B",
  international: "#14B8A6",
  other: "#EC4899",
}

/** Legend entries for event type colours (design-token friendly hex). */
export const EVENT_TYPE_LEGEND: { label: string; color: string }[] = [
  { label: "Racing / Sport", color: "#8B5CF6" },
  { label: "Exhibition", color: "#10B981" },
  { label: "Conference", color: "#3B82F6" },
  { label: "Hospitality", color: "#F97316" },
  { label: "Sponsorship", color: "#EC4899" },
  { label: "Internal", color: "#64748B" },
  { label: "Other", color: "#EC4899" },
]

export type EventAttendanceStatus = "attending" | "maybe" | "not_attending" | "interested"

export type EventCalendarClickAction = "open_detail" | "open_record" | "none"
export type EventCalendarDetailMode = "drawer" | "modal" | "inline" | "record" | "panel"

const STATUS_COLORS: Record<string, string> = {
  idea: "#94A3B8",
  planning: "#F59E0B",
  confirmed: "#10B981",
  attending: "#3B82F6",
  completed: "#64748B",
  cancelled: "#EF4444",
}

type FieldRow = { name: string; type?: string; options?: FieldOptions }

export interface EventFieldMap {
  eventName: string
  startDate: string | null
  endDate: string | null
  allDay: string | null
  startTime: string | null
  endTime: string | null
  timezone: string | null
  eventType: string | null
  status: string | null
  location: string | null
  locationName: string | null
  city: string | null
  country: string | null
  website: string | null
  visibility: string | null
  venue: string | null
  description: string | null
  heroImage: string | null
  linkedTheme: string | null
  campaign: string | null
  owner: string | null
  budget: string | null
  notes: string | null
  attendees: string | null
  scheduleItems: string | null
  resources: string | null
  deletedAt: string | null
}

export interface EventTableIds {
  /** Content table (events are rows with content type = Event). */
  contentTableId: string
  contentSupabaseTable: string
  /** @deprecated Alias for contentTableId — used by RecordModal */
  eventsTableId: string
  /** @deprecated Alias for contentSupabaseTable */
  eventsSupabaseTable: string
  locationsTableId: string | null
  locationsSupabaseTable: string | null
  themesTableId: string | null
  themesSupabaseTable: string | null
}

export interface ContentEventFieldMap extends EventFieldMap {
  contentType: string | null
}

export interface EventScheduleItem {
  label: string
  date: string
  time?: string | null
  notes?: string | null
}

export interface EventResourceItem {
  label: string
  url?: string | null
  type?: string | null
}

export interface MarketingEventItem {
  id: string
  eventName: string
  eventType: string | null
  status: string | null
  startDate: Date | null
  endDate: Date | null
  allDay: boolean
  startTime: string | null
  endTime: string | null
  timezone: string | null
  locationName: string | null
  city: string | null
  country: string | null
  locationLabel: string | null
  websiteUrl: string | null
  description: string | null
  heroImageUrl: string | null
  themeLabel: string | null
  campaignLabel: string | null
  ownerLabel: string | null
  ownerId: string | null
  budget: string | null
  notes: string | null
  attendeeIds: string[]
  attendeeLabels: string[]
  attendeeCount: number
  currentUserAttending: boolean
  /** Resolved from attendees field; extended statuses need Event Attendance table (TODO). */
  currentUserAttendanceStatus: EventAttendanceStatus | null
  visibility: string | null
  venueLabel: string | null
  scheduleItems: EventScheduleItem[]
  resources: EventResourceItem[]
  accentColor: string
  backgroundColor: string
  dateRangeLabel: string
  isPendingApproval: boolean
}

export interface EventCalendarFilters {
  search: string
  eventTypes: string[]
  locations: string[]
  statuses: string[]
  owners: string[]
  attendeeFilter: "all" | "attending" | "mine"
}

export interface EventCalendarEvent {
  id: string
  title: string
  start: string
  end?: string
  allDay: boolean
  accentColor: string
  backgroundColor: string
  extendedProps: Record<string, unknown>
}

/** @deprecated Page identity only — do not use for InterfacePageClient routing. */
export function isEventCalendarPage(page: { name?: string; config?: unknown } | null): boolean {
  if (!page) return false
  const name = String(page.name || "").trim().toLowerCase()
  return name === "event calendar"
}

export type EventCalendarDensity = "comfortable" | "compact"

/** Block settings parsed from PageBlock.config for `event_calendar` blocks. */
export interface EventCalendarBlockSettings {
  title: string
  subtitle: string
  defaultView: EventCalendarViewMode
  mobileDefaultView: EventCalendarViewMode
  showToolbar: boolean
  showMetrics: boolean
  showFilters: boolean
  showSearch: boolean
  showAddButton: boolean
  showActions: boolean
  showAttendanceControls: boolean
  showScheduleTab: boolean
  showResourcesTab: boolean
  showNotesTab: boolean
  showLegend: boolean
  showPageHeader: boolean
  density: EventCalendarDensity
  detailMode: EventCalendarDetailMode
  clickAction: EventCalendarClickAction
  allowAttendanceUpdates: boolean
  allowMemberSubmissions: boolean
  allowCalendarExport: boolean
  externalMode: boolean
}

export function eventCalendarSettingsFromConfig(
  config?: Record<string, unknown> | null
): EventCalendarBlockSettings {
  const c = config || {}
  const view = c.event_calendar_default_view
  const validView =
    view === "week" || view === "list" || view === "timeline" ? view : "month"
  const mobileView = c.event_calendar_mobile_default_view
  const validMobileView =
    mobileView === "week" || mobileView === "month" || mobileView === "timeline"
      ? mobileView
      : "list"

  const detailRaw = c.event_calendar_detail_mode
  const detailMode: EventCalendarDetailMode =
    detailRaw === "modal" ||
    detailRaw === "inline" ||
    detailRaw === "record" ||
    detailRaw === "panel"
      ? detailRaw
      : "drawer"

  const clickRaw = c.event_calendar_click_action
  const clickAction: EventCalendarClickAction =
    clickRaw === "open_record" || clickRaw === "none" ? clickRaw : "open_detail"

  const showStats =
    c.event_calendar_show_stats !== false && c.event_calendar_show_metrics !== false

  return {
    title: String(c.title || "Event Calendar"),
    subtitle: String(
      c.event_calendar_subtitle ||
        "Discover events, manage attendance and sync to your calendar."
    ),
    defaultView: validView,
    mobileDefaultView: validMobileView,
    showToolbar: c.event_calendar_show_toolbar !== false,
    showMetrics: showStats,
    showFilters: c.event_calendar_show_filters !== false,
    showSearch: c.event_calendar_show_search !== false,
    showAddButton: c.event_calendar_show_add_button !== false,
    showActions: c.event_calendar_show_actions !== false,
    showAttendanceControls: c.event_calendar_show_attendance_controls !== false,
    showScheduleTab: c.event_calendar_show_schedule !== false,
    showResourcesTab: c.event_calendar_show_resources !== false,
    showNotesTab: c.event_calendar_show_notes !== false,
    showLegend: c.event_calendar_show_legend !== false,
    showPageHeader: c.event_calendar_show_page_header === true,
    density: c.event_calendar_density === "compact" ? "compact" : "comfortable",
    detailMode,
    clickAction,
    allowAttendanceUpdates: c.event_calendar_allow_attendance_updates !== false,
    allowMemberSubmissions: c.event_calendar_allow_member_submissions === true,
    allowCalendarExport: c.event_calendar_allow_calendar_export !== false,
    externalMode: c.event_calendar_external_mode === true,
  }
}

export const DEFAULT_EVENT_CALENDAR_BLOCK_CONFIG: Record<string, unknown> = {
  title: "Event Calendar",
  event_calendar_subtitle:
    "Discover events, manage attendance and sync to your calendar.",
  event_calendar_default_view: "month",
  event_calendar_mobile_default_view: "list",
  event_calendar_detail_mode: "drawer",
  event_calendar_click_action: "open_detail",
  event_calendar_allow_attendance_updates: true,
  event_calendar_allow_member_submissions: false,
  event_calendar_allow_calendar_export: true,
  event_calendar_external_mode: false,
  event_calendar_show_toolbar: true,
  event_calendar_show_metrics: true,
  event_calendar_show_stats: true,
  event_calendar_show_filters: true,
  event_calendar_show_search: true,
  event_calendar_show_add_button: true,
  event_calendar_show_actions: true,
  event_calendar_show_attendance_controls: true,
  event_calendar_show_schedule: true,
  event_calendar_show_resources: true,
  event_calendar_show_notes: true,
  event_calendar_show_legend: true,
  event_calendar_density: "comfortable",
  event_calendar_submitted_status_value: "Submitted",
  event_calendar_approved_status_value: "Published",
  event_calendar_rejected_status_value: "Cancelled",
  event_calendar_member_default_visibility: "members_only",
  event_calendar_content_type_default: "Event",
  appearance: { showTitle: true },
}

/** Field map when events are Content rows (content type = Event). */
export function resolveContentEventFields(
  fields: FieldRow[],
  overrides?: Partial<Record<keyof EventFieldMap, FieldOverridePair>>,
  contentTypeOverride?: FieldOverridePair
): ContentEventFieldMap {
  const base = resolveEventFields(fields)
  const merged: ContentEventFieldMap = {
    ...base,
    eventName:
      pickFieldName(fields, [/content.?name/i, /event.?name/i, /^name$/i, /^title$/i], "content_name") ||
      base.eventName,
    startDate:
      pickFieldName(
        fields,
        [/^date$/i, /^start_date$/i, /start.?date/i, /publish/i, /from/i, /begin/i, /^dates$/i],
        "date"
      ) || base.startDate,
    endDate:
      pickFieldName(
        fields,
        [/^date_to$/i, /^end_date$/i, /^date_due$/i, /end.?date/i, /until/i],
        "date_to"
      ) || base.endDate,
    contentType: pickFieldName(
      fields,
      [/content.?type/i, /^type$/i, /item.?type/i],
      null
    ),
    eventType:
      pickFieldName(
        fields,
        [/event.?type/i, /category/i, /sub.?type/i, /event.?category/i],
        base.eventType
      ) || base.eventType,
    linkedTheme:
      pickFieldName(fields, [/quarterly.?theme/i, /linked.?theme/i, /^theme$/i], base.linkedTheme) ||
      base.linkedTheme,
    heroImage:
      pickFieldName(fields, [/images/i, /hero/i, /image/i, /photo/i, /banner/i], base.heroImage) ||
      base.heroImage,
  }
  const fieldIds = fields.map((f) => ({ id: (f as { id?: string }).id || f.name, name: f.name }))
  const withOverrides =
    overrides && Object.keys(overrides).length > 0
      ? applyFieldOverrides(merged, overrides, fieldIds)
      : merged
  const contentTypeField =
    (contentTypeOverride &&
      fieldNameFromConfig(fieldIds, contentTypeOverride.fieldId, contentTypeOverride.fieldName)) ||
    withOverrides.contentType ||
    merged.contentType
  return {
    ...withOverrides,
    contentType: contentTypeField,
  }
}

const CONTENT_TYPE_FIELD_FALLBACKS = [
  "content_type",
  "Content Type",
  "contentType",
  "type",
]

/** True when row is marketing content typed as an event. */
export function isEventContentRecord(
  row: Record<string, unknown>,
  contentTypeField: string | null
): boolean {
  const candidates = contentTypeField
    ? [contentTypeField]
    : CONTENT_TYPE_FIELD_FALLBACKS.filter((k) => k in row)

  for (const key of candidates) {
    const raw = row[key]
    if (raw == null) continue
    const values: unknown[] = Array.isArray(raw) ? raw : [raw]
    for (const v of values) {
      const label = formatDisplayValue(v)
      if (!label) continue
      const norm = label.trim().toLowerCase()
      if (norm === "event" || norm === "events") return true
    }
  }
  return false
}

function parseDatesField(raw: unknown): { start: Date | null; end: Date | null } {
  if (raw == null) return { start: null, end: null }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown
      return parseDatesField(parsed)
    } catch {
      const single = parseDateValue(raw)
      return { start: single, end: single }
    }
  }
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>
    const start = parseDateValue(o.start ?? o.from ?? o.startDate)
    const end = parseDateValue(o.end ?? o.to ?? o.endDate)
    return { start, end: end ?? start }
  }
  return { start: null, end: null }
}

export function resolveEventFields(fields: FieldRow[]): EventFieldMap {
  return {
    eventName: pickFieldName(fields, [/event.?name/i, /^name$/i, /^title$/i], "name") || "name",
    startDate: pickFieldName(fields, [/start.?date/i, /^start$/i, /^date$/i, /from/i, /begin/i], null),
    endDate: pickFieldName(fields, [/^date_to$/i, /^end_date$/i, /end.?date/i, /^end$/i, /until/i], null),
    allDay: pickFieldName(fields, [/all.?day/i], null),
    startTime: pickFieldName(fields, [/start.?time/i], null),
    endTime: pickFieldName(fields, [/end.?time/i], null),
    timezone: pickFieldName(fields, [/timezone/i, /time.?zone/i], null),
    eventType: pickFieldName(fields, [/event.?type/i, /^type$/i], null),
    status: pickFieldName(fields, [/status/i], null),
    location: pickFieldName(fields, [/^location$/i, /location.?id/i], null),
    locationName: pickFieldName(fields, [/location.?name/i, /venue/i], null),
    city: pickFieldName(fields, [/city/i], null),
    country: pickFieldName(fields, [/country/i], null),
    website: pickFieldName(fields, [/website/i, /url/i, /link/i], null),
    visibility: pickFieldName(fields, [/visibility/i, /audience/i, /access/i], null),
    venue: pickFieldName(fields, [/venue/i, /hall/i], null),
    description: pickFieldName(fields, [/description/i, /summary/i], null),
    heroImage: pickFieldName(fields, [/hero/i, /image/i, /photo/i, /banner/i], null),
    linkedTheme: pickFieldName(fields, [/linked.?theme/i, /theme/i, /quarterly/i], null),
    campaign: pickFieldName(fields, [/campaign/i], null),
    owner: pickFieldName(fields, [/owner/i, /organiser/i, /organizer/i, /created_by/i], null),
    budget: pickFieldName(fields, [/budget/i], null),
    notes: pickFieldName(fields, [/notes/i, /internal/i], null),
    attendees: pickFieldName(fields, [/attend/i, /attendee_user/i], "attendee_user_ids"),
    scheduleItems: pickFieldName(fields, [/schedule/i, /key.?dates/i], "schedule_items"),
    resources: pickFieldName(fields, [/resources/i, /files/i, /links/i], "resources"),
    deletedAt: pickFieldName(fields, [/deleted_at/i], null),
  }
}

function parseDateValue(raw: unknown): Date | null {
  if (raw == null || raw === "") return null
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return startOfDay(raw)
  const s = String(raw).trim()
  if (!s) return null
  try {
    const d = parseISO(s.length <= 10 ? s : s)
    if (Number.isNaN(d.getTime())) return null
    return startOfDay(d)
  } catch {
    return null
  }
}

const EVENT_END_DATE_FALLBACK_COLUMNS = [
  "date_to",
  "date_due",
  "end_date",
  "event_end",
  "event_end_date",
] as const

const EVENT_START_DATE_FALLBACK_COLUMNS = [
  "date",
  "start_date",
  "event_start",
  "event_start_date",
] as const

/** Resolve start/end from mapped fields plus common Content / Events column names. */
export function resolveEventRowDates(
  row: Record<string, unknown>,
  fields: EventFieldMap
): { startDate: Date | null; endDate: Date | null } {
  let startDate = fields.startDate ? parseDateValue(row[fields.startDate]) : null
  let endDate = fields.endDate ? parseDateValue(row[fields.endDate]) : null

  if (!startDate && fields.startDate === "dates") {
    const range = parseDatesField(row.dates ?? row.Dates)
    startDate = range.start
    endDate = endDate ?? range.end
  }

  if (!startDate) {
    for (const col of EVENT_START_DATE_FALLBACK_COLUMNS) {
      if (col === fields.startDate || col === fields.endDate) continue
      const parsed = parseDateValue(row[col])
      if (parsed) {
        startDate = parsed
        break
      }
    }
  }

  if (startDate && (!endDate || isSameDay(startDate, endDate))) {
    for (const col of EVENT_END_DATE_FALLBACK_COLUMNS) {
      if (col === fields.startDate || col === fields.endDate) continue
      const parsed = parseDateValue(row[col])
      if (parsed && !isSameDay(parsed, startDate)) {
        endDate = parsed
        break
      }
    }
  }

  if (startDate && (!endDate || isSameDay(startDate, endDate))) {
    const range = parseDatesField(row.dates ?? row.Dates ?? row.date_range)
    if (range.end && !isSameDay(range.end, startDate)) endDate = range.end
  }

  if (!endDate && startDate) endDate = startDate
  if (startDate && endDate && isBefore(endDate, startDate)) {
    const swap = startDate
    startDate = endDate
    endDate = swap
  }

  return { startDate, endDate }
}

function parseUuidArray(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v)).filter((id) => /^[0-9a-f-]{36}$/i.test(id))
  }
  if (typeof raw === "string" && raw.startsWith("{")) {
    return raw
      .replace(/[{}]/g, "")
      .split(",")
      .map((s) => s.trim())
      .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
  }
  return []
}

function parseScheduleItems(raw: unknown): EventScheduleItem[] {
  if (!raw) return []
  let arr: unknown[] = []
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw) as unknown[]
    } catch {
      return []
    }
  } else if (Array.isArray(raw)) {
    arr = raw
  } else {
    return []
  }
  return arr
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const o = item as Record<string, unknown>
      const label = formatDisplayValue(o.label) || formatDisplayValue(o.name)
      const date = formatDisplayValue(o.date)
      if (!label || !date) return null
      return {
        label,
        date,
        time: formatDisplayValue(o.time),
        notes: formatDisplayValue(o.notes),
      }
    })
    .filter(Boolean) as EventScheduleItem[]
}

function parseResources(raw: unknown): EventResourceItem[] {
  if (!raw) return []
  let arr: unknown[] = []
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw) as unknown[]
    } catch {
      return []
    }
  } else if (Array.isArray(raw)) {
    arr = raw
  } else {
    return []
  }
  return arr
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const o = item as Record<string, unknown>
      const label = formatDisplayValue(o.label) || formatDisplayValue(o.name) || formatDisplayValue(o.url)
      if (!label) return null
      return {
        label,
        url: formatDisplayValue(o.url),
        type: formatDisplayValue(o.type),
      }
    })
    .filter(Boolean) as EventResourceItem[]
}

function heroFromValue(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === "string" && (raw.startsWith("http") || raw.startsWith("/"))) return raw
  if (Array.isArray(raw) && raw[0]) {
    const first = raw[0]
    if (typeof first === "string") return first
    if (typeof first === "object" && first && "url" in first) {
      return formatDisplayValue((first as { url?: unknown }).url)
    }
  }
  if (typeof raw === "object" && raw && "url" in raw) {
    return formatDisplayValue((raw as { url?: unknown }).url)
  }
  return formatDisplayValue(raw)
}

export function eventTypeAccentColor(eventType: string | null): string {
  if (!eventType) return EVENT_TYPE_COLORS.other
  const key = eventType.trim().toLowerCase()
  return EVENT_TYPE_COLORS[key] || EVENT_TYPE_COLORS.other
}

export function statusAccentColor(status: string | null): string {
  if (!status) return STATUS_COLORS.idea
  const key = status.trim().toLowerCase()
  return STATUS_COLORS[key] || STATUS_COLORS.idea
}

export function accentBackground(accent: string): string {
  const hex = normalizeHexColor(accent) || accent
  if (hex.startsWith("#") && hex.length === 7) return `${hex}1A`
  return `${hex}22`
}

export function formatEventDateRange(start: Date | null, end: Date | null): string {
  if (!start) return "Date TBC"
  if (!end || isSameDay(start, end)) return format(start, "d MMM yyyy")
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, "d")}–${format(end, "d MMM yyyy")}`
  }
  return `${format(start, "d MMM yyyy")} – ${format(end, "d MMM yyyy")}`
}

export function buildEventItems(params: {
  rows: Record<string, unknown>[]
  fields: EventFieldMap
  locationById: Map<string, Record<string, unknown>>
  themeLabelById: Map<string, string>
  profileLabelById: Map<string, string>
  currentUserId: string | null
  contentTypeField?: string | null
  filterContentEvents?: boolean
}): MarketingEventItem[] {
  const {
    rows,
    fields,
    locationById,
    themeLabelById,
    profileLabelById,
    currentUserId,
    contentTypeField = null,
    filterContentEvents = false,
  } = params
  const items: MarketingEventItem[] = []

  for (const row of rows) {
    if (filterContentEvents && !isEventContentRecord(row, contentTypeField)) continue
    if (fields.deletedAt && row[fields.deletedAt]) continue

    const { startDate, endDate: resolvedEnd } = resolveEventRowDates(row, fields)
    const effectiveEnd = resolvedEnd ?? startDate

    const locationId = fields.location ? row[fields.location] : null
    const loc =
      locationId && typeof locationId === "string"
        ? locationById.get(locationId)
        : null

    const locName =
      (fields.locationName ? formatDisplayValue(row[fields.locationName]) : null) ||
      (loc ? formatDisplayValue(loc.name ?? loc.location_name ?? loc.venue) : null)

    const city =
      (fields.city ? formatDisplayValue(row[fields.city]) : null) ||
      (loc ? formatDisplayValue(loc.city) : null)

    const country =
      (fields.country ? formatDisplayValue(row[fields.country]) : null) ||
      (loc ? formatDisplayValue(loc.country) : null)

    const themeId = fields.linkedTheme ? row[fields.linkedTheme] : null
    const themeLabel =
      themeId && typeof themeId === "string"
        ? themeLabelById.get(themeId) ?? null
        : fields.linkedTheme
          ? formatDisplayValue(row[fields.linkedTheme])
          : null

    const attendeeIds = parseUuidArray(
      fields.attendees ? row[fields.attendees] : row.attendee_user_ids
    )
    const attendeeLabels = attendeeIds.map((id) => profileLabelById.get(id) || id.slice(0, 8))
    const userAttending = currentUserId ? attendeeIds.includes(currentUserId) : false
    const currentUserAttendanceStatus: EventAttendanceStatus | null = userAttending
      ? "attending"
      : null
    const visibility = fields.visibility ? formatDisplayValue(row[fields.visibility]) : null
    const venueLabel = fields.venue ? formatDisplayValue(row[fields.venue]) : null

    const eventType = fields.eventType ? formatDisplayValue(row[fields.eventType]) : null
    const status = fields.status ? formatDisplayValue(row[fields.status]) : null
    const accent = eventTypeAccentColor(eventType)

    const ownerRaw = fields.owner ? row[fields.owner] : null
    const ownerId = typeof ownerRaw === "string" ? ownerRaw : null
    const ownerLabel =
      ownerId && profileLabelById.has(ownerId)
        ? profileLabelById.get(ownerId)!
        : formatDisplayValue(ownerRaw)

    const allDayRaw = fields.allDay ? row[fields.allDay] : true
    const allDay =
      allDayRaw === false ||
      allDayRaw === "false" ||
      allDayRaw === 0
        ? false
        : true

    items.push({
      id: String(row.id),
      eventName:
        (fields.eventName ? formatDisplayValue(row[fields.eventName]) : null) || "Untitled event",
      eventType,
      status,
      startDate,
      endDate: effectiveEnd,
      allDay,
      startTime: fields.startTime ? formatDisplayValue(row[fields.startTime]) : null,
      endTime: fields.endTime ? formatDisplayValue(row[fields.endTime]) : null,
      timezone: fields.timezone ? formatDisplayValue(row[fields.timezone]) : null,
      locationName: locName,
      city,
      country,
      locationLabel: [locName, city, country].filter(Boolean).join(", ") || null,
      websiteUrl: fields.website ? formatDisplayValue(row[fields.website]) : null,
      description: fields.description ? formatDisplayValue(row[fields.description]) : null,
      heroImageUrl: fields.heroImage ? heroFromValue(row[fields.heroImage]) : null,
      themeLabel,
      campaignLabel: fields.campaign ? formatDisplayValue(row[fields.campaign]) : null,
      ownerLabel,
      ownerId,
      budget: fields.budget ? formatDisplayValue(row[fields.budget]) : null,
      notes: fields.notes ? formatDisplayValue(row[fields.notes]) : null,
      attendeeIds,
      attendeeLabels,
      attendeeCount: attendeeIds.length,
      currentUserAttending: userAttending,
      currentUserAttendanceStatus,
      visibility,
      venueLabel,
      scheduleItems: parseScheduleItems(
        fields.scheduleItems ? row[fields.scheduleItems] : row.schedule_items
      ),
      resources: parseResources(fields.resources ? row[fields.resources] : row.resources),
      accentColor: accent,
      backgroundColor: accentBackground(accent),
      dateRangeLabel: formatEventDateRange(startDate, effectiveEnd),
      isPendingApproval: isPendingApprovalStatus(status),
    })
  }

  return items.sort((a, b) => {
    const ta = a.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER
    const tb = b.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER
    return ta - tb
  })
}

export function filterEventItems(
  items: MarketingEventItem[],
  filters: EventCalendarFilters,
  currentUserId: string | null
): MarketingEventItem[] {
  const q = filters.search.trim().toLowerCase()
  return items.filter((item) => {
    if (q) {
      const hay = [
        item.eventName,
        item.locationLabel,
        item.eventType,
        item.status,
        item.themeLabel,
        item.ownerLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (filters.eventTypes.length) {
      const type = (item.eventType || "").trim().toLowerCase()
      const allowed = filters.eventTypes.map((t) => t.trim().toLowerCase())
      if (!type || !allowed.includes(type)) return false
    }
    if (filters.statuses.length) {
      const status = (item.status || "").trim().toLowerCase()
      const allowed = filters.statuses.map((s) => s.trim().toLowerCase())
      if (!status || !allowed.includes(status)) return false
    }
    if (filters.locations.length) {
      const loc = (item.locationLabel || item.country || "").trim().toLowerCase()
      const allowed = filters.locations.map((l) => l.trim().toLowerCase())
      if (!loc || !allowed.some((l) => loc === l || loc.includes(l))) return false
    }
    if (filters.owners.length) {
      const owner = (item.ownerLabel || "").trim()
      if (!owner || !filters.owners.includes(owner)) return false
    }
    if (filters.attendeeFilter === "attending" && currentUserId && !item.attendeeIds.includes(currentUserId)) {
      return false
    }
    if (filters.attendeeFilter === "mine" && currentUserId && item.ownerId !== currentUserId) {
      return false
    }
    return true
  })
}

export interface EventTimelineRange {
  months: Date[]
  rangeStart: Date
  rangeEnd: Date
  totalDays: number
}

/** Month columns spanning all dated events (±1 month padding), not only the cursor month. */
export function buildEventTimelineRange(
  items: MarketingEventItem[],
  cursorDate: Date = new Date()
): EventTimelineRange {
  const dated = items.filter((i) => i.startDate)
  const cursorMonth = startOfMonth(cursorDate)

  if (dated.length === 0) {
    const months = [0, 1, 2, 3, 4, 5].map((i) => startOfMonth(addMonths(cursorMonth, i)))
    const rangeStart = months[0]
    const rangeEnd = addMonths(months[months.length - 1], 1)
    return {
      months,
      rangeStart,
      rangeEnd,
      totalDays: Math.max(differenceInDays(rangeEnd, rangeStart), 1),
    }
  }

  let minDate = dated[0].startDate!
  let maxDate = dated[0].endDate ?? dated[0].startDate!
  for (const item of dated) {
    const s = item.startDate!
    const e = item.endDate ?? s
    if (s < minDate) minDate = s
    if (e > maxDate) maxDate = e
  }

  const rangeStart = startOfMonth(addMonths(minDate, -1))
  const lastMonth = startOfMonth(addMonths(maxDate, 1))
  const months: Date[] = []
  let cur = rangeStart
  while (cur <= lastMonth && months.length < 36) {
    months.push(cur)
    cur = addMonths(cur, 1)
  }
  if (months.length === 0) months.push(startOfMonth(minDate))

  const rangeEnd = addMonths(months[months.length - 1], 1)
  return {
    months,
    rangeStart: months[0],
    rangeEnd,
    totalDays: Math.max(differenceInDays(rangeEnd, months[0]), 1),
  }
}

export function positionEventOnTimeline(
  item: MarketingEventItem,
  range: EventTimelineRange
): { leftPct: number; widthPct: number; isSingleDay: boolean } | null {
  if (!item.startDate) return null

  const start = startOfDay(item.startDate)
  const end = startOfDay(item.endDate ?? item.startDate)
  const rangeStartMs = range.rangeStart.getTime()
  const rangeEndMs = range.rangeEnd.getTime()
  const itemStartMs = start.getTime()
  const itemEndExclusive = addDays(end, 1).getTime()

  if (itemEndExclusive <= rangeStartMs || itemStartMs >= rangeEndMs) return null

  const clippedStart = Math.max(itemStartMs, rangeStartMs)
  const clippedEnd = Math.min(itemEndExclusive, rangeEndMs)
  const startOff = differenceInDays(new Date(clippedStart), range.rangeStart)
  const widthDays = Math.max(differenceInDays(new Date(clippedEnd), new Date(clippedStart)), 1)
  const isSingleDay = isSameDay(start, end)

  return {
    leftPct: (startOff / range.totalDays) * 100,
    widthPct: Math.max((widthDays / range.totalDays) * 100, isSingleDay ? 2.5 : 1.5),
    isSingleDay,
  }
}

export function getEventTimelineTodayPct(range: EventTimelineRange, today = new Date()): number | null {
  const t = startOfDay(today).getTime()
  const start = range.rangeStart.getTime()
  const end = range.rangeEnd.getTime()
  if (t < start || t >= end) return null
  return ((t - start) / (end - start)) * 100
}

export function buildEventCalendarEvents(items: MarketingEventItem[]): EventCalendarEvent[] {
  return items
    .filter((item) => item.startDate)
    .map((item) => {
      const start = format(item.startDate!, "yyyy-MM-dd")
      let end: string | undefined
      if (item.endDate && item.startDate && !isSameDay(item.startDate, item.endDate)) {
        end = format(addDays(item.endDate, 1), "yyyy-MM-dd")
      }
      const fc: EventCalendarEvent = {
        id: item.id,
        title: item.eventName,
        start,
        allDay: item.allDay,
        accentColor: item.accentColor,
        backgroundColor: item.backgroundColor,
        extendedProps: {
          eventType: item.eventType,
          status: item.status,
          locationLabel: item.locationLabel,
          dateRangeLabel: item.dateRangeLabel,
          attendeeLabels: item.attendeeLabels,
          attendeeCount: item.attendeeCount,
          accentColor: item.accentColor,
        },
      }
      if (end) fc.end = end
      if (!item.allDay && item.startTime) {
        const startIso = `${start}T${item.startTime.length === 5 ? item.startTime : item.startTime.slice(0, 5)}:00`
        fc.start = startIso
        fc.allDay = false
        if (item.endTime) {
          const endDay = item.endDate ? format(item.endDate, "yyyy-MM-dd") : start
          fc.end = `${endDay}T${item.endTime.length === 5 ? item.endTime : item.endTime.slice(0, 5)}:00`
        }
      }
      return fc
    })
}

export function collectEventFilterOptions(items: MarketingEventItem[]) {
  const eventTypes = new Set<string>()
  const locations = new Set<string>()
  const statuses = new Set<string>()
  const owners = new Set<string>()
  for (const item of items) {
    if (item.eventType) eventTypes.add(item.eventType)
    if (item.status) statuses.add(item.status)
    if (item.ownerLabel) owners.add(item.ownerLabel)
    if (item.locationLabel) locations.add(item.locationLabel)
    else if (item.country) locations.add(item.country)
  }
  return {
    eventTypes: Array.from(eventTypes).sort(),
    locations: Array.from(locations).sort(),
    statuses: Array.from(statuses).sort(),
    owners: Array.from(owners).sort(),
  }
}

export function computeEventMetrics(items: MarketingEventItem[], referenceDate = new Date()) {
  const now = startOfDay(referenceDate)
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const upcomingWindow = addDays(now, 90)

  let upcoming = 0
  let thisMonth = 0
  const attendeeSet = new Set<string>()
  const countries = new Set<string>()

  for (const item of items) {
    if (item.country) countries.add(item.country)
    for (const id of item.attendeeIds) attendeeSet.add(id)
    if (!item.startDate) continue
    const rangeEnd = item.endDate ?? item.startDate
    if (
      !isBefore(rangeEnd, now) &&
      !isAfter(item.startDate, upcomingWindow)
    ) {
      upcoming += 1
    }
    if (
      isWithinInterval(item.startDate, { start: monthStart, end: monthEnd }) ||
      (rangeEnd &&
        isWithinInterval(rangeEnd, { start: monthStart, end: monthEnd })) ||
      (item.startDate <= monthStart && rangeEnd >= monthEnd)
    ) {
      thisMonth += 1
    }
  }

  return {
    upcoming,
    teamAttending: attendeeSet.size,
    countries: countries.size,
    thisMonth,
  }
}

export function groupEventsByMonth(items: MarketingEventItem[]): { label: string; items: MarketingEventItem[] }[] {
  const groups = new Map<string, MarketingEventItem[]>()
  for (const item of items) {
    const d = item.startDate ?? item.endDate
    const label = d ? format(d, "MMMM yyyy") : "Unscheduled"
    const list = groups.get(label) ?? []
    list.push(item)
    groups.set(label, list)
  }
  return Array.from(groups.entries()).map(([label, groupItems]) => ({
    label,
    items: groupItems,
  }))
}
