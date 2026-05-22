/**
 * Content Timeline block — mock data and helpers.
 *
 * TODO: connect timeline items to the Content table.
 * TODO: connect themes to Quarterly Themes table.
 * TODO: connect campaigns to Campaigns table.
 * TODO: connect channels/statuses to existing select fields.
 * TODO: support drag-and-drop date changes later.
 * TODO: support opening the existing RecordEditor / RecordModal.
 * TODO: support permissions for who can add/edit content.
 */

import {
  addMonths,
  addWeeks,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from "date-fns"

export type ContentTimelineView = "month" | "quarter" | "year"
export type ContentTimelineGroupBy = "theme" | "channel" | "status" | "owner"

export type ContentTimelineItemType =
  | "social"
  | "website"
  | "blog"
  | "newsletter"
  | "campaign"
  | "event"
  | "case-study"
  | "email"
  | "press-release"
  | "ad"

export type ContentTimelineChannel =
  | "website"
  | "linkedin"
  | "instagram"
  | "facebook"
  | "email"
  | "google-ads"
  | "pr"
  | "internal"

export type ContentTimelineStatus =
  | "idea"
  | "planned"
  | "in-progress"
  | "awaiting-approval"
  | "approved"
  | "scheduled"
  | "published"
  | "needs-update"

export interface ContentTimelineItem {
  id: string
  title: string
  theme: string
  type: ContentTimelineItemType
  channel: ContentTimelineChannel
  status: ContentTimelineStatus
  owner?: string
  startDate: string
  endDate?: string
  publishDate?: string
  campaign?: string
  division?: string
  brief?: string
  notes?: string
  assetStatus?: string
  approvalStatus?: string
  colour?: string
}

export interface ContentTimelineFilters {
  themes: string[]
  types: string[]
  channels: string[]
  statuses: string[]
  owners: string[]
  divisions: string[]
  search: string
  dateFrom?: string
  dateTo?: string
}

export interface TimelineColumn {
  id: string
  label: string
  sublabel?: string
  start: Date
  end: Date
}

export interface TimelineItemPosition {
  leftPct: number
  widthPct: number
  isSingleDay: boolean
}

export const CONTENT_TIMELINE_THEMES = [
  "Yacht Transport",
  "Racing Logistics",
  "Forwarding",
  "Commercial Marine",
  "Sustainability",
  "Events",
  "Case Studies",
  "Customer Education",
  "Seasonal Campaigns",
] as const

export const CONTENT_TIMELINE_TYPES: { value: ContentTimelineItemType; label: string }[] = [
  { value: "social", label: "Social post" },
  { value: "website", label: "Website page" },
  { value: "blog", label: "Blog / article" },
  { value: "newsletter", label: "Newsletter" },
  { value: "campaign", label: "Campaign" },
  { value: "event", label: "Event" },
  { value: "case-study", label: "Case study" },
  { value: "email", label: "Email" },
  { value: "press-release", label: "Press release" },
  { value: "ad", label: "Ad / paid campaign" },
]

export const CONTENT_TIMELINE_CHANNELS: { value: ContentTimelineChannel; label: string }[] = [
  { value: "website", label: "Website" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "email", label: "Email" },
  { value: "google-ads", label: "Google Ads" },
  { value: "pr", label: "PR" },
  { value: "internal", label: "Internal" },
]

export const CONTENT_TIMELINE_STATUSES: { value: ContentTimelineStatus; label: string }[] = [
  { value: "idea", label: "Idea" },
  { value: "planned", label: "Planned" },
  { value: "in-progress", label: "In progress" },
  { value: "awaiting-approval", label: "Awaiting approval" },
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "needs-update", label: "Needs update" },
]

export const CONTENT_TIMELINE_DIVISIONS = [
  "Marketing",
  "Digital",
  "PR",
  "Events",
] as const

const THEME_STYLES: Record<string, { dot: string; strip: string; rowBg: string; barBg: string; barBorder: string }> = {
  "Yacht Transport": {
    dot: "bg-blue-500",
    strip: "bg-blue-400",
    rowBg: "bg-blue-50/40",
    barBg: "bg-blue-100/90",
    barBorder: "border-blue-200/80",
  },
  "Racing Logistics": {
    dot: "bg-violet-500",
    strip: "bg-violet-400",
    rowBg: "bg-violet-50/40",
    barBg: "bg-violet-100/90",
    barBorder: "border-violet-200/80",
  },
  Forwarding: {
    dot: "bg-teal-500",
    strip: "bg-teal-400",
    rowBg: "bg-teal-50/40",
    barBg: "bg-teal-100/90",
    barBorder: "border-teal-200/80",
  },
  "Commercial Marine": {
    dot: "bg-amber-500",
    strip: "bg-amber-400",
    rowBg: "bg-amber-50/40",
    barBg: "bg-amber-100/90",
    barBorder: "border-amber-200/80",
  },
  Events: {
    dot: "bg-pink-500",
    strip: "bg-pink-400",
    rowBg: "bg-pink-50/40",
    barBg: "bg-pink-100/90",
    barBorder: "border-pink-200/80",
  },
  Sustainability: {
    dot: "bg-emerald-500",
    strip: "bg-emerald-400",
    rowBg: "bg-emerald-50/40",
    barBg: "bg-emerald-100/90",
    barBorder: "border-emerald-200/80",
  },
  "Case Studies": {
    dot: "bg-slate-500",
    strip: "bg-slate-400",
    rowBg: "bg-slate-50/40",
    barBg: "bg-slate-100/90",
    barBorder: "border-slate-200/80",
  },
  "Customer Education": {
    dot: "bg-indigo-500",
    strip: "bg-indigo-400",
    rowBg: "bg-indigo-50/40",
    barBg: "bg-indigo-100/90",
    barBorder: "border-indigo-200/80",
  },
  "Seasonal Campaigns": {
    dot: "bg-orange-500",
    strip: "bg-orange-400",
    rowBg: "bg-orange-50/40",
    barBg: "bg-orange-100/90",
    barBorder: "border-orange-200/80",
  },
  "Product Launch Campaign": {
    dot: "bg-[#6D4AFF]",
    strip: "bg-[#6D4AFF]",
    rowBg: "bg-[#F3F0FF]/40",
    barBg: "bg-[#F3F0FF]",
    barBorder: "border-[#6D4AFF]/30",
  },
  "Social Media Series": {
    dot: "bg-emerald-500",
    strip: "bg-emerald-500",
    rowBg: "bg-[#EAF8F0]/50",
    barBg: "bg-[#EAF8F0]",
    barBorder: "border-emerald-200/80",
  },
  "Blog Post: Industry Trends": {
    dot: "bg-blue-500",
    strip: "bg-blue-500",
    rowBg: "bg-[#EAF3FF]/50",
    barBg: "bg-[#EAF3FF]",
    barBorder: "border-blue-200/80",
  },
  "Email Newsletter": {
    dot: "bg-amber-500",
    strip: "bg-amber-500",
    rowBg: "bg-[#FFF1E5]/50",
    barBg: "bg-[#FFF1E5]",
    barBorder: "border-amber-200/80",
  },
  "Webinar Promotion": {
    dot: "bg-violet-400",
    strip: "bg-violet-400",
    rowBg: "bg-[#F3F0FF]/30",
    barBg: "bg-violet-100/90",
    barBorder: "border-violet-200/80",
  },
}

const DEFAULT_THEME_STYLE = {
  dot: "bg-gray-400",
  strip: "bg-gray-300",
  rowBg: "bg-muted/30",
  barBg: "bg-muted/60",
  barBorder: "border-border",
}

export function getThemeStyles(theme: string) {
  return THEME_STYLES[theme] ?? DEFAULT_THEME_STYLE
}

const STATUS_CLASSES: Record<ContentTimelineStatus, { bg: string; text: string; legend: string }> = {
  idea: { bg: "bg-gray-100", text: "text-gray-700", legend: "bg-gray-400" },
  planned: { bg: "bg-sky-100", text: "text-sky-800", legend: "bg-sky-400" },
  "in-progress": { bg: "bg-blue-100", text: "text-blue-800", legend: "bg-blue-500" },
  "awaiting-approval": { bg: "bg-amber-100", text: "text-amber-900", legend: "bg-amber-400" },
  approved: { bg: "bg-emerald-100", text: "text-emerald-800", legend: "bg-emerald-500" },
  scheduled: { bg: "bg-violet-100", text: "text-violet-800", legend: "bg-violet-500" },
  published: { bg: "bg-teal-100", text: "text-teal-800", legend: "bg-teal-500" },
  "needs-update": { bg: "bg-red-100", text: "text-red-800", legend: "bg-red-500" },
}

export function getContentTimelineStatusClasses(status: ContentTimelineStatus) {
  return STATUS_CLASSES[status] ?? STATUS_CLASSES.idea
}

export function getStatusLabel(status: ContentTimelineStatus): string {
  return CONTENT_TIMELINE_STATUSES.find((s) => s.value === status)?.label ?? status
}

export function getTypeLabel(type: ContentTimelineItemType): string {
  return CONTENT_TIMELINE_TYPES.find((t) => t.value === type)?.label ?? type
}

export function getChannelLabel(channel: ContentTimelineChannel): string {
  return CONTENT_TIMELINE_CHANNELS.find((c) => c.value === channel)?.label ?? channel
}

export const CONTENT_TIMELINE_MOCK_ITEMS: ContentTimelineItem[] = [
  {
    id: "ct-1",
    title: "Monaco Yacht Show campaign page",
    theme: "Yacht Transport",
    type: "website",
    channel: "website",
    status: "in-progress",
    owner: "Alex King",
    startDate: "2025-05-12",
    endDate: "2025-05-26",
    publishDate: "2025-05-26",
    campaign: "Monaco Yacht Show 2025",
    division: "Digital",
    brief: "Landing page for Monaco Yacht Show with transport services, case studies and lead form.",
    assetStatus: "In progress",
    approvalStatus: "Awaiting approval",
  },
  {
    id: "ct-2",
    title: "Southampton Boat Show social posts",
    theme: "Events",
    type: "social",
    channel: "linkedin",
    status: "planned",
    owner: "Sam Lee",
    startDate: "2025-05-28",
    endDate: "2025-06-14",
    campaign: "Southampton Boat Show 2025",
    division: "Marketing",
    brief: "Pre-show awareness and on-site coverage across LinkedIn and Instagram.",
  },
  {
    id: "ct-3",
    title: "ARC sailing schedule newsletter",
    theme: "Racing Logistics",
    type: "newsletter",
    channel: "email",
    status: "scheduled",
    owner: "Jordan Mills",
    startDate: "2025-06-02",
    endDate: "2025-06-02",
    publishDate: "2025-06-02",
    division: "Marketing",
    brief: "Quarterly ARC schedule update for agents and yacht owners.",
  },
  {
    id: "ct-4",
    title: "Racing logistics case study",
    theme: "Racing Logistics",
    type: "case-study",
    channel: "website",
    status: "awaiting-approval",
    owner: "Alex King",
    startDate: "2025-05-19",
    endDate: "2025-06-30",
    division: "Digital",
    assetStatus: "Ready for review",
    approvalStatus: "Awaiting approval",
  },
  {
    id: "ct-5",
    title: "Commercial marine landing page update",
    theme: "Commercial Marine",
    type: "website",
    channel: "website",
    status: "in-progress",
    owner: "Priya Shah",
    startDate: "2025-06-01",
    endDate: "2025-07-15",
    division: "Digital",
  },
  {
    id: "ct-6",
    title: "Sustainability article",
    theme: "Sustainability",
    type: "blog",
    channel: "website",
    status: "idea",
    owner: "Sam Lee",
    startDate: "2025-07-01",
    endDate: "2025-07-20",
    brief: "Thought leadership on decarbonisation in yacht transport.",
  },
  {
    id: "ct-7",
    title: "Fort Lauderdale campaign",
    theme: "Seasonal Campaigns",
    type: "campaign",
    channel: "google-ads",
    status: "approved",
    owner: "Jordan Mills",
    startDate: "2025-05-01",
    endDate: "2025-07-31",
    campaign: "Fort Lauderdale 2025",
    division: "Digital",
  },
  {
    id: "ct-8",
    title: "Forwarding explainer post",
    theme: "Forwarding",
    type: "social",
    channel: "linkedin",
    status: "published",
    owner: "Priya Shah",
    startDate: "2025-05-08",
    endDate: "2025-05-08",
    publishDate: "2025-05-08",
    division: "Marketing",
  },
  {
    id: "ct-9",
    title: "Customer FAQ refresh",
    theme: "Customer Education",
    type: "website",
    channel: "website",
    status: "needs-update",
    owner: "Alex King",
    startDate: "2025-05-15",
    endDate: "2025-06-10",
    division: "Digital",
    notes: "Update pricing and route FAQs after Q2 rate change.",
  },
  {
    id: "ct-10",
    title: "Google Ads landing page test",
    theme: "Commercial Marine",
    type: "ad",
    channel: "google-ads",
    status: "scheduled",
    owner: "Jordan Mills",
    startDate: "2025-06-15",
    endDate: "2025-07-01",
    division: "Digital",
  },
]

/** Marketing Home dashboard preset — May 2025 week-style rows. */
export const MARKETING_HOME_TIMELINE_ITEMS: ContentTimelineItem[] = [
  {
    id: "mh-ct-1",
    title: "Product Launch Campaign",
    theme: "Product Launch Campaign",
    type: "campaign",
    channel: "website",
    status: "in-progress",
    startDate: "2025-05-12",
    endDate: "2025-05-18",
    division: "Marketing",
  },
  {
    id: "mh-ct-2",
    title: "Social Media Series",
    theme: "Social Media Series",
    type: "social",
    channel: "linkedin",
    status: "planned",
    startDate: "2025-05-13",
    endDate: "2025-05-17",
    division: "Marketing",
  },
  {
    id: "mh-ct-3",
    title: "Blog Post: Industry Trends",
    theme: "Blog Post: Industry Trends",
    type: "blog",
    channel: "website",
    status: "scheduled",
    startDate: "2025-05-14",
    endDate: "2025-05-16",
    division: "Digital",
  },
  {
    id: "mh-ct-4",
    title: "Email Newsletter",
    theme: "Email Newsletter",
    type: "newsletter",
    channel: "email",
    status: "approved",
    startDate: "2025-05-15",
    endDate: "2025-05-15",
    division: "Marketing",
  },
  {
    id: "mh-ct-5",
    title: "Webinar Promotion",
    theme: "Webinar Promotion",
    type: "campaign",
    channel: "email",
    status: "planned",
    startDate: "2025-05-16",
    endDate: "2025-05-18",
    division: "Marketing",
  },
]

export function getContentTimelineMockItems(
  preset?: "marketing_home" | "default"
): ContentTimelineItem[] {
  return preset === "marketing_home"
    ? MARKETING_HOME_TIMELINE_ITEMS
    : CONTENT_TIMELINE_MOCK_ITEMS
}

function parseItemDate(iso: string): Date {
  return parseISO(iso.length === 10 ? `${iso}T12:00:00` : iso)
}

function itemRange(item: ContentTimelineItem): { start: Date; end: Date } {
  const start = parseItemDate(item.startDate)
  const end = parseItemDate(item.endDate ?? item.publishDate ?? item.startDate)
  return start <= end ? { start, end } : { start: end, end: start }
}

export function filterContentTimelineItems(
  items: ContentTimelineItem[],
  filters: ContentTimelineFilters
): ContentTimelineItem[] {
  const q = filters.search.trim().toLowerCase()
  return items.filter((item) => {
    if (filters.themes.length && !filters.themes.includes(item.theme)) return false
    if (filters.types.length && !filters.types.includes(item.type)) return false
    if (filters.channels.length && !filters.channels.includes(item.channel)) return false
    if (filters.statuses.length && !filters.statuses.includes(item.status)) return false
    if (filters.owners.length && (!item.owner || !filters.owners.includes(item.owner))) return false
    if (filters.divisions.length && (!item.division || !filters.divisions.includes(item.division))) return false
    if (filters.dateFrom || filters.dateTo) {
      const { start, end } = itemRange(item)
      const from = filters.dateFrom ? parseItemDate(filters.dateFrom) : null
      const to = filters.dateTo ? parseItemDate(filters.dateTo) : null
      if (from && end < from) return false
      if (to && start > to) return false
    }
    if (q) {
      const hay = [
        item.title,
        item.theme,
        item.campaign,
        item.brief,
        item.notes,
        item.owner,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export function getViewRange(view: ContentTimelineView, anchor: Date): { start: Date; end: Date } {
  if (view === "month") {
    return { start: startOfMonth(anchor), end: endOfMonth(anchor) }
  }
  if (view === "quarter") {
    return { start: startOfQuarter(anchor), end: endOfQuarter(anchor) }
  }
  return { start: startOfYear(anchor), end: endOfYear(anchor) }
}

function buildWeekColumns(rangeStart: Date, rangeEnd: Date): TimelineColumn[] {
  const cols: TimelineColumn[] = []
  let cursor = startOfWeek(rangeStart, { weekStartsOn: 1 })
  while (cursor <= rangeEnd) {
    const weekEnd = endOfWeek(cursor, { weekStartsOn: 1 })
    const start = cursor < rangeStart ? rangeStart : cursor
    const end = weekEnd > rangeEnd ? rangeEnd : weekEnd
    const weekNum = format(cursor, "w")
    cols.push({
      id: format(cursor, "yyyy-MM-dd"),
      label: `W${weekNum}`,
      sublabel: `${format(start, "d MMM")}`,
      start,
      end,
    })
    cursor = addWeeks(cursor, 1)
  }
  return cols
}

function buildMonthColumns(rangeStart: Date, rangeEnd: Date): TimelineColumn[] {
  const cols: TimelineColumn[] = []
  let cursor = startOfMonth(rangeStart)
  while (cursor <= rangeEnd) {
    const monthEnd = endOfMonth(cursor)
    const start = cursor < rangeStart ? rangeStart : cursor
    const end = monthEnd > rangeEnd ? rangeEnd : monthEnd
    cols.push({
      id: format(cursor, "yyyy-MM"),
      label: format(cursor, "MMM yyyy").toUpperCase(),
      start,
      end,
    })
    cursor = addMonths(cursor, 1)
  }
  return cols
}

export function buildTimelineColumns(view: ContentTimelineView, anchorDate: Date): TimelineColumn[] {
  const { start, end } = getViewRange(view, anchorDate)
  if (view === "year") return buildMonthColumns(start, end)
  return buildWeekColumns(start, end)
}

export function formatPeriodLabel(view: ContentTimelineView, anchorDate: Date): string {
  if (view === "month") return format(anchorDate, "MMMM yyyy")
  if (view === "quarter") {
    const { start, end } = getViewRange(view, anchorDate)
    return `${format(start, "MMM")} – ${format(end, "MMM yyyy")}`
  }
  return format(anchorDate, "yyyy")
}

export function shiftAnchorDate(
  view: ContentTimelineView,
  anchor: Date,
  direction: -1 | 1
): Date {
  if (view === "month") return addMonths(anchor, direction)
  if (view === "quarter") return addMonths(anchor, direction * 3)
  return addMonths(anchor, direction * 12)
}

export function groupTimelineItems(
  items: ContentTimelineItem[],
  groupBy: ContentTimelineGroupBy
): { key: string; label: string; items: ContentTimelineItem[] }[] {
  const map = new Map<string, ContentTimelineItem[]>()
  for (const item of items) {
    let key: string
    switch (groupBy) {
      case "channel":
        key = item.channel
        break
      case "status":
        key = item.status
        break
      case "owner":
        key = item.owner || "Unassigned"
        break
      default:
        key = item.theme
    }
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }
  const groups = Array.from(map.entries()).map(([key, groupItems]) => {
    let label = key
    if (groupBy === "channel") label = getChannelLabel(key as ContentTimelineChannel)
    if (groupBy === "status") label = getStatusLabel(key as ContentTimelineStatus)
    return { key, label, items: groupItems }
  })
  if (groupBy === "theme") {
    const order = [...CONTENT_TIMELINE_THEMES]
    groups.sort((a, b) => {
      const ai = order.indexOf(a.key as (typeof CONTENT_TIMELINE_THEMES)[number])
      const bi = order.indexOf(b.key as (typeof CONTENT_TIMELINE_THEMES)[number])
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
  } else {
    groups.sort((a, b) => a.label.localeCompare(b.label))
  }
  return groups
}

export function positionItemOnTimeline(
  item: ContentTimelineItem,
  columns: TimelineColumn[]
): TimelineItemPosition | null {
  if (columns.length === 0) return null
  const rangeStart = columns[0].start.getTime()
  const rangeEnd = columns[columns.length - 1].end.getTime()
  const total = rangeEnd - rangeStart
  if (total <= 0) return null

  const { start, end } = itemRange(item)
  const startMs = Math.max(start.getTime(), rangeStart)
  const endMs = Math.min(end.getTime(), rangeEnd)
  if (endMs < rangeStart || startMs > rangeEnd) return null

  const leftPct = ((startMs - rangeStart) / total) * 100
  const widthPct = Math.max(((endMs - startMs) / total) * 100, 2.5)
  const isSingleDay = format(start, "yyyy-MM-dd") === format(end, "yyyy-MM-dd")

  return {
    leftPct,
    widthPct: isSingleDay ? Math.max(widthPct, 4) : widthPct,
    isSingleDay,
  }
}

export function getTodayMarkerPct(columns: TimelineColumn[], today = new Date()): number | null {
  if (columns.length === 0) return null
  const rangeStart = columns[0].start.getTime()
  const rangeEnd = columns[columns.length - 1].end.getTime()
  const t = today.getTime()
  if (t < rangeStart || t > rangeEnd) return null
  return ((t - rangeStart) / (rangeEnd - rangeStart)) * 100
}

export function formatDisplayDate(iso: string): string {
  return format(parseItemDate(iso), "d MMM yyyy")
}

export function ownerInitials(owner?: string): string {
  if (!owner?.trim()) return "?"
  const parts = owner.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function collectFilterOptions(items: ContentTimelineItem[]) {
  const owners = new Set<string>()
  const divisions = new Set<string>()
  for (const item of items) {
    if (item.owner) owners.add(item.owner)
    if (item.division) divisions.add(item.division)
  }
  return {
    owners: Array.from(owners).sort(),
    divisions: Array.from(divisions).sort(),
  }
}

export function itemOverlapsView(item: ContentTimelineItem, view: ContentTimelineView, anchor: Date): boolean {
  const { start: viewStart, end: viewEnd } = getViewRange(view, anchor)
  const { start, end } = itemRange(item)
  return isWithinInterval(start, { start: viewStart, end: viewEnd }) ||
    isWithinInterval(end, { start: viewStart, end: viewEnd }) ||
    (start <= viewStart && end >= viewEnd)
}
