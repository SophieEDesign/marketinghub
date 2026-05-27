/**
 * Map Quarterly Themes table rows → Content Theme block cards.
 */

import { applyFieldOverrides, type FieldOverridePair } from "@/lib/marketing/block-config-resolver"
import { pickFieldName, formatDisplayValue } from "@/lib/marketing/field-utils"
import type { ContentThemeItem, ContentThemeStatus } from "@/lib/interface/content-theme-mock-data"

export interface ThemeFieldMap {
  name: string
  quarter: string | null
  year: string | null
  color: string | null
  divisions: string | null
}

export function resolveThemeFields(
  fields: Array<{ id?: string; name: string }>,
  overrides?: Partial<Record<keyof ThemeFieldMap, FieldOverridePair>>
): ThemeFieldMap {
  const base: ThemeFieldMap = {
    name:
      pickFieldName(fields, [/^name$/i, /^theme$/i, /theme_name/i, /^title$/i], "name") || "name",
    quarter: pickFieldName(fields, [/^quarter$/i, /fiscal_quarter/i], null),
    year: pickFieldName(fields, [/^year$/i, /fiscal_year/i], null),
    color: pickFieldName(fields, [/theme_colou?r/i, /^colou?r$/i, /accent/i], null),
    divisions: pickFieldName(fields, [/lead_divisions/i, /divisions/i], null),
  }
  if (!overrides || Object.keys(overrides).length === 0) return base
  const fieldIds = fields.map((f) => ({ id: f.id || f.name, name: f.name }))
  return applyFieldOverrides(base, overrides, fieldIds)
}

const ACCENTS: ContentThemeItem["accent"][] = ["blue", "purple", "green", "red"]

function accentFromColor(color: string | null, index: number): ContentThemeItem["accent"] {
  if (!color) return ACCENTS[index % ACCENTS.length]
  const c = color.toLowerCase()
  if (c.includes("6d4aff") || c.includes("purple")) return "purple"
  if (c.includes("10b981") || c.includes("green")) return "green"
  if (c.includes("ef4444") || c.includes("red") || c.includes("rose")) return "red"
  return "blue"
}

function statusFromQuarter(
  quarter: string | null,
  selectedQuarter: string,
  selectedYear: number
): ContentThemeStatus {
  const q = (quarter || "").trim().toUpperCase()
  const sel = selectedQuarter.toUpperCase()
  if (!q) return "Upcoming"
  const qNum = parseInt(q.replace(/\D/g, ""), 10)
  const selNum = parseInt(sel.replace(/\D/g, ""), 10)
  if (qNum < selNum) return "Previous"
  if (qNum === selNum) return "Active"
  return "Upcoming"
}

export function buildContentThemeItems(
  rows: Record<string, unknown>[],
  fields: ThemeFieldMap,
  opts: { selectedQuarter: string; selectedYear: number }
): ContentThemeItem[] {
  return rows.map((row, index) => {
    const title = formatDisplayValue(row[fields.name]) || "Theme"
    const quarter =
      formatDisplayValue(fields.quarter ? row[fields.quarter] : undefined) ||
      opts.selectedQuarter
    const status = statusFromQuarter(quarter, opts.selectedQuarter, opts.selectedYear)
    const colorRaw = fields.color ? formatDisplayValue(row[fields.color]) : null
    return {
      id: String(row.id),
      title,
      quarter: quarter || "Q1",
      status,
      themeType: "Quarterly theme",
      description: fields.divisions
        ? formatDisplayValue(row[fields.divisions]) ?? undefined
        : undefined,
      ideas: [],
      accent: accentFromColor(colorRaw, index),
    }
  })
}
