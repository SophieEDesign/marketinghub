/**
 * Content Planning — shared field resolution, items, and filtering for marketing blocks.
 */

import { pickFieldName, formatDisplayValue } from "@/lib/marketing/field-utils"
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

export type QuarterNum = 1 | 2 | 3 | 4

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

const COMPLETED_STATUSES =
  /published|complete|completed|done|live|posted/i

export function getCurrentQuarter(): QuarterNum {
  const m = new Date().getMonth()
  return (Math.floor(m / 3) + 1) as QuarterNum
}

export function quarterLabel(q: QuarterNum): string {
  return `Q${q}`
}

export function parseQuarterFromValue(value: unknown): QuarterNum | null {
  if (value == null) return null
  const s = String(value).trim().toUpperCase()
  const m = s.match(/Q?([1-4])/)
  if (m) return Number(m[1]) as QuarterNum
  const n = Number(s)
  if (n >= 1 && n <= 4) return n as QuarterNum
  return null
}

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
  const one = extractLinkedId(value)
  return one ? [one] : []
}

function isCompletedStatus(status: string | null): boolean {
  if (!status) return false
  return COMPLETED_STATUSES.test(status)
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
      pickFieldName(themeFields, [/^name$/i, /^theme$/i, /theme_name/i, /^title$/i], null) ||
      "theme",
    themeQuarter: pickFieldName(themeFields, [/^quarter$/i, /fiscal_quarter/i], null),
    themeYear: pickFieldName(themeFields, [/^year$/i, /fiscal_year/i], null),
    themeColor: pickFieldName(themeFields, [/theme_colou?r/i, /^colou?r$/i, /accent/i], null),
    themeDivisions: pickFieldName(themeFields, [/lead_divisions/i, /divisions/i], null),
  }
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
  years.add(new Date().getFullYear())

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
  fields: ContentPlanningFieldMap
  contentFields: FieldRow[]
  themeLabelById: Map<string, string>
  themeColorById: Map<string, string>
}): ContentPlanningItem[] {
  const { contentRows, fields, contentFields, themeLabelById, themeColorById } = params
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
      const title = formatDisplayValue(row[fields.contentName]) || "Untitled content"
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

export function filterContentItems<T extends ContentPlanningItem>(
  items: T[],
  filters: ContentPlanningFilters
): T[] {
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

export function buildThemeMaps(
  themeRows: Record<string, unknown>[],
  fields: ContentPlanningFieldMap
): { labelById: Map<string, string>; colorById: Map<string, string> } {
  const labelById = new Map<string, string>()
  const colorById = new Map<string, string>()

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
    if (!color && fields.themeQuarter) {
      const q = parseQuarterFromValue(row[fields.themeQuarter])
      if (q != null) color = SEMANTIC_COLORS[(q - 1) % SEMANTIC_COLORS.length]
    }
    colorById.set(id, color ?? SEMANTIC_COLORS[index % SEMANTIC_COLORS.length])
  })

  return { labelById, colorById }
}
