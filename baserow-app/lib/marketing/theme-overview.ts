/**
 * Theme Overview dashboard — field resolution, quarter logic, and grouping.
 * Uses flexible field-name matching so it works across schema variants.
 */

import { isUuidLikeDisplayValue } from "@/lib/marketing/enrich-theme-rows"
import { normalizeHexColor, resolveChoiceColor, SEMANTIC_COLORS } from "@/lib/field-colors"
import type { FieldOptions } from "@/types/fields"

export type QuarterNum = 1 | 2 | 3 | 4

export interface ThemeOverviewFieldMap {
  themeName: string
  quarter: string | null
  coreTitle: string | null
  description: string | null
  year: string | null
  themeDate: string | null
  themeColor: string | null
  contentName: string
  contentTheme: string | null
  contentPrompt: string | null
}

export interface ThemeOverviewPrompt {
  id: string
  label: string
}

export interface ThemeOverviewCard {
  id: string
  name: string
  quarter: QuarterNum | null
  quarterLabel: string | null
  coreTitle: string | null
  description: string | null
  accentColor: string
  prompts: ThemeOverviewPrompt[]
  isCurrentQuarter: boolean
}

export interface MarketingTableIds {
  quarterlyThemesTableId: string
  quarterlyThemesSupabaseTable: string
  contentTableId: string
  contentSupabaseTable: string
}

type FieldRow = { name: string; type?: string; options?: FieldOptions }

function normalizeFieldName(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export function pickFieldName(
  fields: FieldRow[] | null | undefined,
  patterns: RegExp[],
  fallback: string | null = null
): string | null {
  const names = (fields || []).map((f) => f.name).filter(Boolean)
  for (const pattern of patterns) {
    const hit = names.find(
      (name) => pattern.test(name) || pattern.test(normalizeFieldName(name))
    )
    if (hit) return hit
  }
  return fallback
}

export function resolveThemeOverviewFields(
  themeFields: FieldRow[],
  contentFields: FieldRow[]
): ThemeOverviewFieldMap {
  const themeName =
    pickFieldName(themeFields, [/^name$/i, /theme_name/i, /^title$/i, /^theme$/i, /label/i], null) ||
    "name"
  const themeNameMeta = themeFields.find((f) => f.name === themeName)
  const coreFromLookup = pickFieldName(
    themeFields,
    [/core_title/i, /core_theme/i, /key_focus/i, /business_focus/i, /headline/i],
    null
  )
  // When `name` is a link to Core Theme, a lookup column (e.g. core_title) holds the pulled label.
  const coreTitle =
    themeNameMeta?.type === "link_to_table" && coreFromLookup && coreFromLookup !== themeName
      ? coreFromLookup
      : pickFieldName(
          themeFields,
          [/core_title/i, /core_theme/i, /key_focus/i, /business_focus/i, /focus/i, /headline/i],
          null
        )
  return {
    themeName,
    quarter: pickFieldName(themeFields, [/^quarter$/i, /fiscal_quarter/i, /qtr/i], null),
    coreTitle,
    description: pickFieldName(
      themeFields,
      [/summary/i, /description/i, /brief/i, /notes?/i, /key_message/i],
      null
    ),
    year: pickFieldName(themeFields, [/^year$/i, /fiscal_year/i, /planning_year/i], null),
    themeDate: pickFieldName(
      themeFields,
      [/start_date/i, /^date$/i, /period_start/i, /from_date/i],
      null
    ),
    themeColor: pickFieldName(
      themeFields,
      [/theme_colou?r/i, /^colou?r$/i, /accent/i],
      null
    ),
    contentName: pickFieldName(
      contentFields,
      [/content_name/i, /^name$/i, /title/i, /headline/i],
      "content_name"
    )!,
    contentTheme: pickFieldName(contentFields, [/quarterly_theme/i, /^theme$/i, /linked_theme/i], null),
    contentPrompt: pickFieldName(
      contentFields,
      [/prompt/i, /idea/i, /notes_detail/i, /content_post_text/i],
      null
    ),
  }
}

export function getCurrentQuarter(date = new Date()): QuarterNum {
  return (Math.floor(date.getMonth() / 3) + 1) as QuarterNum
}

export function quarterLabel(q: QuarterNum): string {
  return `Q${q}`
}

/** Parse quarter from field value or theme name (e.g. "Q2 — Growth"). */
export function parseQuarterFromValue(value: unknown, themeName?: string): QuarterNum | null {
  const tryString = (s: string): QuarterNum | null => {
    const m = s.match(/\bQ\s*([1-4])\b/i) || s.match(/\b([1-4])\s*(?:st|nd|rd|th)?\s*quarter\b/i)
    if (!m) return null
    const n = Number(m[1])
    return n >= 1 && n <= 4 ? (n as QuarterNum) : null
  }

  if (typeof value === "string" && value.trim()) {
    const fromField = tryString(value.trim())
    if (fromField) return fromField
  }
  if (typeof value === "number" && value >= 1 && value <= 4) return value as QuarterNum
  if (themeName) return tryString(themeName)
  return null
}

export function extractYearFromRow(
  row: Record<string, unknown>,
  fields: ThemeOverviewFieldMap
): number | null {
  if (fields.year) {
    const y = row[fields.year]
    if (y != null && y !== "") {
      const n = Number(String(y).replace(/[^\d]/g, "").slice(0, 4))
      if (!Number.isNaN(n) && n > 1900 && n < 2100) return n
    }
  }
  if (fields.themeDate) {
    const d = row[fields.themeDate]
    if (d) {
      const parsed = new Date(String(d))
      if (!Number.isNaN(parsed.getTime())) return parsed.getFullYear()
    }
  }
  const name = String(row[fields.themeName] ?? "")
  const yearInName = name.match(/\b(20\d{2})\b/)
  if (yearInName) return Number(yearInName[1])
  return null
}

/** Card title: first non-empty candidate (name is often blank while core_title holds the label). */
export function resolveThemeDisplayName(
  row: Record<string, unknown>,
  fields: ThemeOverviewFieldMap,
  themeFields: FieldRow[]
): string {
  const themeNameMeta = themeFields.find((f) => f.name === fields.themeName)
  const nameIsLink = themeNameMeta?.type === "link_to_table"

  const candidateKeys = [
    // Lookup pull of core theme label (populated by enrichThemeRowsForDisplay)
    fields.coreTitle,
    ...(nameIsLink ? [] : [fields.themeName]),
    fields.themeName,
    pickFieldName(themeFields, [/core_title/i], null),
    pickFieldName(themeFields, [/^theme$/i, /theme_name/i, /label/i], null),
    fields.quarter,
  ].filter(Boolean) as string[]

  const seen = new Set<string>()
  for (const key of candidateKeys) {
    if (seen.has(key)) continue
    seen.add(key)
    const text = formatDisplayValue(row[key])
    if (text && !isUuidLikeDisplayValue(text)) return text
  }

  const quarter = fields.quarter ? parseQuarterFromValue(row[fields.quarter]) : null
  if (quarter != null) return quarterLabel(quarter)

  return "Untitled theme"
}

export function formatDisplayValue(value: unknown): string | null {
  if (value == null || value === "") return null
  if (Array.isArray(value)) {
    const parts = value.map((v) => formatDisplayValue(v)).filter(Boolean) as string[]
    return parts.length ? parts.join(", ") : null
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>
    if (typeof o.label === "string") return o.label
    if (typeof o.name === "string") return o.name
    if (typeof o.value === "string") return o.value
  }
  const text = String(value).trim() || null
  if (text && isUuidLikeDisplayValue(text)) return null
  return text
}

function quarterAccentColor(quarter: QuarterNum | null, index: number): string {
  if (quarter != null) {
    return SEMANTIC_COLORS[(quarter - 1) % SEMANTIC_COLORS.length]
  }
  return SEMANTIC_COLORS[index % SEMANTIC_COLORS.length]
}

export function resolveThemeAccentColor(
  row: Record<string, unknown>,
  fields: ThemeOverviewFieldMap,
  quarter: QuarterNum | null,
  index: number,
  quarterFieldMeta?: FieldRow | null
): string {
  if (fields.themeColor) {
    const raw = row[fields.themeColor]
    const text = formatDisplayValue(raw)
    if (text?.startsWith("#")) {
      try {
        return normalizeHexColor(text)
      } catch {
        /* fall through */
      }
    }
    if (quarterFieldMeta && (quarterFieldMeta.type === "single_select" || quarterFieldMeta.type === "multi_select")) {
      const hex = resolveChoiceColor(
        text ?? "",
        quarterFieldMeta.type,
        quarterFieldMeta.options,
        quarterFieldMeta.type === "single_select"
      )
      if (hex) return normalizeHexColor(hex)
    }
  }
  return quarterAccentColor(quarter, index)
}

export function buildThemeCards(params: {
  themeRows: Record<string, unknown>[]
  contentRows: Record<string, unknown>[]
  fields: ThemeOverviewFieldMap
  themeFields: FieldRow[]
  selectedYear: number
  currentQuarter: QuarterNum
}): ThemeOverviewCard[] {
  const { themeRows, contentRows, fields, themeFields, selectedYear, currentQuarter } = params
  const quarterFieldMeta = fields.quarter
    ? themeFields.find((f) => f.name === fields.quarter) ?? null
    : null

  const themesForYear = themeRows.filter((row) => {
    const y = extractYearFromRow(row, fields)
    return y === selectedYear || (y == null && selectedYear === new Date().getFullYear())
  })

  const contentByTheme = new Map<string, ThemeOverviewPrompt[]>()
  for (const row of contentRows) {
    if (!fields.contentTheme) continue
    const themeRef = row[fields.contentTheme]
    const themeId =
      typeof themeRef === "string"
        ? themeRef
        : themeRef && typeof themeRef === "object" && "id" in (themeRef as object)
          ? String((themeRef as { id: string }).id)
          : null
    if (!themeId) continue

    const label =
      formatDisplayValue(row[fields.contentName]) ||
      (fields.contentPrompt ? formatDisplayValue(row[fields.contentPrompt]) : null) ||
      "Untitled"
    const list = contentByTheme.get(themeId) || []
    list.push({ id: String(row.id), label })
    contentByTheme.set(themeId, list)
  }

  const cards: ThemeOverviewCard[] = themesForYear.map((row, index) => {
    const id = String(row.id)
    const coreTitle = fields.coreTitle ? formatDisplayValue(row[fields.coreTitle]) : null
    const name = resolveThemeDisplayName(row, fields, themeFields)
    const quarterRaw = fields.quarter ? row[fields.quarter] : null
    const quarter = parseQuarterFromValue(quarterRaw, name)
    const description = fields.description ? formatDisplayValue(row[fields.description]) : null
    const qLabel =
      formatDisplayValue(quarterRaw) || (quarter != null ? quarterLabel(quarter) : null)

    return {
      id,
      name,
      quarter,
      quarterLabel: qLabel,
      coreTitle,
      description,
      accentColor: resolveThemeAccentColor(row, fields, quarter, index, quarterFieldMeta),
      prompts: contentByTheme.get(id) || [],
      isCurrentQuarter: quarter === currentQuarter,
    }
  })

  cards.sort((a, b) => {
    const aq = a.quarter ?? 99
    const bq = b.quarter ?? 99
    if (aq !== bq) return aq - bq
    return a.name.localeCompare(b.name)
  })

  return cards
}

export function collectAvailableYears(
  themeRows: Record<string, unknown>[],
  fields: ThemeOverviewFieldMap
): number[] {
  const years = new Set<number>()
  const current = new Date().getFullYear()
  years.add(current)
  for (const row of themeRows) {
    const y = extractYearFromRow(row, fields)
    if (y != null) years.add(y)
  }
  return Array.from(years).sort((a, b) => b - a)
}

export function isThemeOverviewPage(page: { name?: string; config?: unknown } | null): boolean {
  if (!page) return false
  const cfg = page.config as { layout_style?: string } | undefined
  const name = String(page.name || "").trim().toLowerCase()
  return (
    cfg?.layout_style === "theme_overview" ||
    name === "theme workspace" ||
    name === "theme dashboard"
  )
}
