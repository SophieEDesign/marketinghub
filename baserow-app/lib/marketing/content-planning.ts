/**
 * Content Planning dashboard — field resolution, filtering, gaps, and calendar events.
 */

import {
  formatDisplayValue,
  getCurrentQuarter,
  parseQuarterFromValue,
  pickFieldName,
  quarterLabel,
  type QuarterNum,
} from "@/lib/marketing/theme-overview"
import { resolveChoiceColor, normalizeHexColor, SEMANTIC_COLORS } from "@/lib/field-colors"
import type { FieldOptions } from "@/types/fields"
import {
  addDays,
  endOfMonth,
  endOfQuarter,
  format,
  isBefore,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfQuarter,
} from "date-fns"

export type ContentColorMode = "theme" | "contentType" | "status"
export type CalendarViewMode = "month" | "weeks4" | "weeks6" | "weeks8"

type FieldRow = { name: string; type?: string; options?: FieldOptions }

export interface ContentPlanningFieldMap {
  contentName: string
  contentDate: string | null
  contentDueDate: string | null
  contentStatus: string | null
  contentType: string | null
  contentTheme: string | null
  contentCampaign: string | null
  contentOwner: string | null
  contentDivision: string | null
  isArchived: string | null
  deletedAt: string | null
  campaignName: string
  campaignStatus: string | null
  campaignContent: string | null
  campaignTheme: string | null
  themeName: string
  themeQuarter: string | null
  themeYear: string | null
  themeColor: string | null
  themeDivisions: string | null
}

export interface ContentPlanningTableIds {
  contentTableId: string
  contentSupabaseTable: string
  campaignsTableId: string
  campaignsSupabaseTable: string
  themesTableId: string
  themesSupabaseTable: string
}

export interface ContentPlanningItem {
  id: string
  title: string
  date: Date | null
  dueDate: Date | null
  status: string | null
  contentType: string | null
  themeId: string | null
  themeLabel: string | null
  campaignIds: string[]
  assignee: string | null
  division: string | null
  accentColor: string
  isOverdue: boolean
  isUpcoming: boolean
}

export interface ContentPlanningFilters {
  year: number
  quarter: QuarterNum | "all"
  contentTypes: string[]
  divisions: string[]
  statuses: string[]
  search: string
}

export interface ContentGap {
  id: string
  label: string
  detail: string
  severity: "info" | "warning"
}

export interface CampaignCard {
  id: string
  name: string
  status: string | null
  postsPlanned: number
  scheduledCount: number
  overdueCount: number
  themeLabel: string | null
}

export interface CalendarPlanningEvent {
  id: string
  title: string
  start: string
  contentType: string | null
  status: string | null
  accentColor: string
  backgroundColor: string
}

const COMPLETED_STATUSES = [
  "published",
  "complete",
  "completed",
  "done",
  "live",
  "posted",
  "approved",
]

function parseLocalDate(value: unknown): Date | null {
  if (value == null || value === "") return null
  const s = String(value).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = parseISO(`${s}T00:00:00`)
    return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function extractLinkedId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (value && typeof value === "object" && "id" in (value as object)) {
    return String((value as { id: string }).id)
  }
  if (Array.isArray(value) && value.length > 0) return extractLinkedId(value[0])
  return null
}

function extractLinkedIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(extractLinkedId).filter(Boolean) as string[]
  }
  const single = extractLinkedId(value)
  return single ? [single] : []
}

function isCompletedStatus(status: string | null): boolean {
  if (!status) return false
  return COMPLETED_STATUSES.some((s) => status.toLowerCase().includes(s))
}

function softBackground(hex: string): string {
  try {
    const normalized = normalizeHexColor(hex)
    return `${normalized}22`
  } catch {
    return "hsl(var(--muted))"
  }
}

export function resolveContentPlanningFields(
  contentFields: FieldRow[],
  campaignFields: FieldRow[],
  themeFields: FieldRow[]
): ContentPlanningFieldMap {
  return {
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
      pickFieldName(themeFields, [/^name$/i, /theme_name/i, /^title$/i], null) || "name",
    themeQuarter: pickFieldName(themeFields, [/^quarter$/i, /fiscal_quarter/i], null),
    themeYear: pickFieldName(themeFields, [/^year$/i, /fiscal_year/i], null),
    themeColor: pickFieldName(themeFields, [/theme_colou?r/i, /^colou?r$/i, /accent/i], null),
    themeDivisions: pickFieldName(themeFields, [/lead_divisions/i, /divisions/i], null),
  }
}

export function isContentPlanningPage(page: { name?: string; config?: unknown } | null): boolean {
  if (!page) return false
  const cfg = page.config as { layout_style?: string } | undefined
  const name = String(page.name || "").trim().toLowerCase()
  return cfg?.layout_style === "content_planning" || name === "content planning"
}

export function getQuarterDateRange(year: number, quarter: QuarterNum): { start: Date; end: Date } {
  const start = startOfQuarter(new Date(year, (quarter - 1) * 3, 1))
  const end = endOfQuarter(start)
  return { start, end }
}

export function collectFilterOptions(items: ContentPlanningItem[]): {
  contentTypes: string[]
  divisions: string[]
  statuses: string[]
  years: number[]
} {
  const contentTypes = new Set<string>()
  const divisions = new Set<string>()
  const statuses = new Set<string>()
  const years = new Set<number>()
  const currentYear = new Date().getFullYear()
  years.add(currentYear)

  for (const item of items) {
    if (item.contentType) contentTypes.add(item.contentType)
    if (item.division) divisions.add(item.division)
    if (item.status) statuses.add(item.status)
    const d = item.date ?? item.dueDate
    if (d) years.add(d.getFullYear())
  }

  return {
    contentTypes: Array.from(contentTypes).sort(),
    divisions: Array.from(divisions).sort(),
    statuses: Array.from(statuses).sort(),
    years: Array.from(years).sort((a, b) => b - a),
  }
}

function rowPassesArchiveGuards(
  row: Record<string, unknown>,
  fields: ContentPlanningFieldMap
): boolean {
  if (fields.isArchived) {
    const v = row[fields.isArchived]
    if (v === true || v === "true" || v === 1 || v === "1") return false
  }
  if (fields.deletedAt) {
    const v = row[fields.deletedAt]
    if (v != null && v !== "") return false
  }
  if (row.deleted_at != null && row.deleted_at !== "") return false
  return true
}

export function buildContentItems(params: {
  contentRows: Record<string, unknown>[]
  themeRows: Record<string, unknown>[]
  fields: ContentPlanningFieldMap
  contentFields: FieldRow[]
  themeFields: FieldRow[]
  themeLabelById: Map<string, string>
  themeColorById: Map<string, string>
}): ContentPlanningItem[] {
  const { contentRows, fields, contentFields, themeFields, themeLabelById, themeColorById } =
    params
  const statusMeta = fields.contentStatus
    ? contentFields.find((f) => f.name === fields.contentStatus)
    : null
  const typeMeta = fields.contentType
    ? contentFields.find((f) => f.name === fields.contentType)
    : null
  const today = startOfDay(new Date())

  return contentRows
    .filter((row) => rowPassesArchiveGuards(row, fields))
    .map((row, index) => {
      const title =
        formatDisplayValue(row[fields.contentName]) || "Untitled content"
      const date = fields.contentDate ? parseLocalDate(row[fields.contentDate]) : null
      const dueDate = fields.contentDueDate
        ? parseLocalDate(row[fields.contentDueDate])
        : null
      const status = fields.contentStatus
        ? formatDisplayValue(row[fields.contentStatus])
        : null
      const contentType = fields.contentType
        ? formatDisplayValue(row[fields.contentType])
        : null
      const themeId = fields.contentTheme ? extractLinkedId(row[fields.contentTheme]) : null
      const themeLabel = themeId ? themeLabelById.get(themeId) ?? null : null
      const campaignIds = fields.contentCampaign
        ? extractLinkedIds(row[fields.contentCampaign])
        : []
      const assignee = fields.contentOwner
        ? formatDisplayValue(row[fields.contentOwner])
        : null
      const division = fields.contentDivision
        ? formatDisplayValue(row[fields.contentDivision])
        : null

      const themeColor = themeId ? themeColorById.get(themeId) : null
      const typeColor =
        contentType && typeMeta
          ? resolveChoiceColor(
              contentType,
              typeMeta.type === "single_select" ? "single_select" : "multi_select",
              typeMeta.options,
              true
            )
          : null
      const statusColor =
        status && statusMeta
          ? resolveChoiceColor(
              status,
              statusMeta.type === "single_select" ? "single_select" : "multi_select",
              statusMeta.options,
              true
            )
          : null

      const accentColor =
        themeColor ||
        (typeColor ? normalizeHexColor(typeColor) : null) ||
        (statusColor ? normalizeHexColor(statusColor) : null) ||
        SEMANTIC_COLORS[index % SEMANTIC_COLORS.length]

      const effectiveDate = date ?? dueDate
      const isOverdue =
        !isCompletedStatus(status) &&
        effectiveDate != null &&
        isBefore(startOfDay(effectiveDate), today)
      const isUpcoming =
        effectiveDate != null &&
        !isBefore(startOfDay(effectiveDate), today) &&
        isWithinInterval(startOfDay(effectiveDate), {
          start: today,
          end: addDays(today, 14),
        })

      return {
        id: String(row.id),
        title,
        date,
        dueDate,
        status,
        contentType,
        themeId,
        themeLabel,
        campaignIds,
        assignee,
        division,
        accentColor,
        isOverdue,
        isUpcoming,
      }
    })
}

export function filterContentItems(
  items: ContentPlanningItem[],
  filters: ContentPlanningFilters
): ContentPlanningItem[] {
  const search = filters.search.trim().toLowerCase()
  const { start: qStart, end: qEnd } =
    filters.quarter === "all"
      ? { start: new Date(filters.year, 0, 1), end: new Date(filters.year, 11, 31) }
      : getQuarterDateRange(filters.year, filters.quarter)

  return items.filter((item) => {
    const d = item.date ?? item.dueDate
    if (d) {
      if (d.getFullYear() !== filters.year) return false
      if (filters.quarter !== "all" && !isWithinInterval(d, { start: qStart, end: qEnd })) {
        return false
      }
    } else if (filters.quarter !== "all" || filters.year !== new Date().getFullYear()) {
      return false
    }

    if (filters.contentTypes.length && item.contentType) {
      if (!filters.contentTypes.includes(item.contentType)) return false
    } else if (filters.contentTypes.length && !item.contentType) {
      return false
    }

    if (filters.divisions.length && item.division) {
      if (!filters.divisions.includes(item.division)) return false
    } else if (filters.divisions.length && !item.division) {
      return false
    }

    if (filters.statuses.length && item.status) {
      if (!filters.statuses.includes(item.status)) return false
    } else if (filters.statuses.length && !item.status) {
      return false
    }

    if (search) {
      const haystack = [item.title, item.themeLabel, item.status, item.contentType, item.assignee]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      if (!haystack.includes(search)) return false
    }

    return true
  })
}

export function resolveItemColor(
  item: ContentPlanningItem,
  mode: ContentColorMode,
  statusColors: Map<string, string>,
  typeColors: Map<string, string>
): string {
  if (mode === "status" && item.status && statusColors.has(item.status)) {
    return statusColors.get(item.status)!
  }
  if (mode === "contentType" && item.contentType && typeColors.has(item.contentType)) {
    return typeColors.get(item.contentType)!
  }
  return item.accentColor
}

export function buildCalendarEvents(
  items: ContentPlanningItem[],
  colorMode: ContentColorMode,
  statusColors: Map<string, string>,
  typeColors: Map<string, string>
): CalendarPlanningEvent[] {
  return items
    .filter((item) => item.date)
    .map((item) => {
      const accent = resolveItemColor(item, colorMode, statusColors, typeColors)
      return {
        id: item.id,
        title: item.title,
        start: format(item.date!, "yyyy-MM-dd"),
        contentType: item.contentType,
        status: item.status,
        accentColor: accent,
        backgroundColor: softBackground(accent),
      }
    })
}

export function getUpcomingDeadlines(
  items: ContentPlanningItem[],
  limit = 8
): ContentPlanningItem[] {
  const today = startOfDay(new Date())
  return items
    .filter((item) => {
      const d = item.dueDate ?? item.date
      return d && !isBefore(startOfDay(d), today) && !isCompletedStatus(item.status)
    })
    .sort((a, b) => {
      const da = a.dueDate ?? a.date!
      const db = b.dueDate ?? b.date!
      return da.getTime() - db.getTime()
    })
    .slice(0, limit)
}

export function getOverdueItems(items: ContentPlanningItem[]): ContentPlanningItem[] {
  return items.filter((item) => item.isOverdue)
}

export function getUpcomingContentList(
  items: ContentPlanningItem[],
  limit = 12
): ContentPlanningItem[] {
  return items
    .filter((item) => (item.date ?? item.dueDate) && !item.isOverdue)
    .sort((a, b) => {
      const da = a.date ?? a.dueDate!
      const db = b.date ?? b.dueDate!
      return da.getTime() - db.getTime()
    })
    .slice(0, limit)
}

export function detectContentGaps(
  items: ContentPlanningItem[],
  filters: ContentPlanningFilters,
  themeRows: Record<string, unknown>[],
  fields: ContentPlanningFieldMap
): ContentGap[] {
  const gaps: ContentGap[] = []
  const range =
    filters.quarter === "all"
      ? { start: startOfMonth(new Date(filters.year, 0, 1)), end: endOfMonth(new Date(filters.year, 11, 1)) }
      : getQuarterDateRange(filters.year, filters.quarter)

  const datedItems = items.filter((i) => i.date ?? i.dueDate)
  const daysWithContent = new Set<string>()
  for (const item of datedItems) {
    const d = item.date ?? item.dueDate!
    daysWithContent.add(format(d, "yyyy-MM-dd"))
  }

  let emptyWeeks = 0
  let cursor = startOfDay(range.start)
  while (cursor <= range.end) {
    const weekEnd = addDays(cursor, 6)
    let weekHasContent = false
    for (let d = cursor; d <= weekEnd && d <= range.end; d = addDays(d, 1)) {
      if (daysWithContent.has(format(d, "yyyy-MM-dd"))) {
        weekHasContent = true
        break
      }
    }
    if (!weekHasContent) emptyWeeks++
    cursor = addDays(cursor, 7)
  }

  if (emptyWeeks > 0) {
    gaps.push({
      id: "empty-weeks",
      label: `${emptyWeeks} week${emptyWeeks === 1 ? "" : "s"} with no content`,
      detail: `No planned items in ${filters.quarter === "all" ? filters.year : `${quarterLabel(filters.quarter)} ${filters.year}`}`,
      severity: emptyWeeks >= 3 ? "warning" : "info",
    })
  }

  const divisionCounts = new Map<string, number>()
  for (const item of items) {
    if (!item.division) continue
    divisionCounts.set(item.division, (divisionCounts.get(item.division) ?? 0) + 1)
  }
  for (const [division, count] of divisionCounts) {
    if (count <= 1) {
      gaps.push({
        id: `low-${division}`,
        label: `Low coverage: ${division}`,
        detail: `Only ${count} item${count === 1 ? "" : "s"} planned`,
        severity: "warning",
      })
    }
  }

  if (fields.contentTheme && fields.themeQuarter) {
    const themesInPeriod = themeRows.filter((row) => {
      const qRaw = fields.themeQuarter ? row[fields.themeQuarter] : null
      const q = parseQuarterFromValue(qRaw)
      if (filters.quarter !== "all" && q !== filters.quarter) return false
      if (fields.themeYear) {
        const y = formatDisplayValue(row[fields.themeYear])
        if (y && Number(y) !== filters.year) return false
      }
      return true
    })
    const themesWithContent = new Set(items.map((i) => i.themeId).filter(Boolean))
    const missing = themesInPeriod.filter((t) => !themesWithContent.has(String(t.id)))
    if (missing.length > 0 && missing.length <= 4) {
      gaps.push({
        id: "themes-without-content",
        label: `${missing.length} theme${missing.length === 1 ? "" : "s"} without content`,
        detail: "Active themes in this period have no linked posts",
        severity: "warning",
      })
    } else if (missing.length > 4) {
      gaps.push({
        id: "themes-without-content",
        label: `${missing.length} themes without content`,
        detail: "Several themes lack planned posts this period",
        severity: "warning",
      })
    }
  }

  if (gaps.length === 0) {
    gaps.push({
      id: "all-good",
      label: "No major gaps detected",
      detail: "Coverage looks healthy for the selected period",
      severity: "info",
    })
  }

  return gaps.slice(0, 6)
}

export function buildCampaignCards(params: {
  campaignRows: Record<string, unknown>[]
  items: ContentPlanningItem[]
  fields: ContentPlanningFieldMap
  themeLabelById: Map<string, string>
  limit?: number
}): CampaignCard[] {
  const { campaignRows, items, fields, themeLabelById, limit = 6 } = params
  const today = startOfDay(new Date())
  const contentById = new Map(items.map((i) => [i.id, i]))

  const cards: CampaignCard[] = campaignRows.map((row) => {
    const id = String(row.id)
    const name = formatDisplayValue(row[fields.campaignName]) || "Untitled campaign"
    const status = fields.campaignStatus
      ? formatDisplayValue(row[fields.campaignStatus])
      : null
    const linkedIds = fields.campaignContent
      ? extractLinkedIds(row[fields.campaignContent])
      : []
    const linkedItems = linkedIds
      .map((cid) => contentById.get(cid))
      .filter(Boolean) as ContentPlanningItem[]
    const themeId = fields.campaignTheme ? extractLinkedId(row[fields.campaignTheme]) : null
    const themeLabel = themeId ? themeLabelById.get(themeId) ?? null : null

    let scheduledCount = 0
    let overdueCount = 0
    for (const item of linkedItems) {
      const d = item.date ?? item.dueDate
      if (d && !isBefore(startOfDay(d), today)) scheduledCount++
      if (item.isOverdue) overdueCount++
    }

    return {
      id,
      name,
      status,
      postsPlanned: linkedItems.length,
      scheduledCount,
      overdueCount,
      themeLabel,
    }
  })

  return cards
    .filter((c) => c.postsPlanned > 0 || c.status?.toLowerCase() !== "archived")
    .sort((a, b) => b.overdueCount - a.overdueCount || b.postsPlanned - a.postsPlanned)
    .slice(0, limit)
}

export function buildChoiceColorMap(
  fieldMeta: FieldRow | undefined,
  values: string[]
): Map<string, string> {
  const map = new Map<string, string>()
  if (!fieldMeta) return map
  values.forEach((value, index) => {
    const hex = resolveChoiceColor(
      value,
      fieldMeta.type === "single_select" ? "single_select" : "multi_select",
      fieldMeta.options,
      true
    )
    map.set(value, hex ? normalizeHexColor(hex) : SEMANTIC_COLORS[index % SEMANTIC_COLORS.length])
  })
  return map
}

export function buildThemeMaps(
  themeRows: Record<string, unknown>[],
  fields: ContentPlanningFieldMap,
  themeFields: FieldRow[]
): { labelById: Map<string, string>; colorById: Map<string, string> } {
  const labelById = new Map<string, string>()
  const colorById = new Map<string, string>()
  const quarterMeta = fields.themeQuarter
    ? themeFields.find((f) => f.name === fields.themeQuarter)
    : null

  themeRows.forEach((row, index) => {
    const id = String(row.id)
    const name = formatDisplayValue(row[fields.themeName]) || "Theme"
    labelById.set(id, name)

    let color: string | null = null
    if (fields.themeColor) {
      const raw = formatDisplayValue(row[fields.themeColor])
      if (raw?.startsWith("#")) {
        try {
          color = normalizeHexColor(raw)
        } catch {
          /* ignore */
        }
      }
    }
    if (!color && fields.themeQuarter && quarterMeta) {
      const q = parseQuarterFromValue(row[fields.themeQuarter], name)
      if (q != null) color = SEMANTIC_COLORS[(q - 1) % SEMANTIC_COLORS.length]
    }
    colorById.set(id, color ?? SEMANTIC_COLORS[index % SEMANTIC_COLORS.length])
  })

  return { labelById, colorById }
}

export { getCurrentQuarter, quarterLabel, type QuarterNum }
