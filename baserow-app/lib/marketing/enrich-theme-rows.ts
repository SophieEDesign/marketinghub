/**
 * Resolve link_to_table + lookup values on Quarterly Theme rows for dashboard display.
 * The primary `name` field is often a link to Core Theme (stores UUIDs only).
 */

import { createClient } from "@/lib/supabase/client"
import {
  getLinkedFieldValueFromRow,
  linkedValueToIds,
  resolveLinkedFieldDisplayMap,
} from "@/lib/dataView/linkedFields"
import { computeLookupValues, type GridRow } from "@/lib/grid/computeLookupValues"
import type { LinkedField, TableField } from "@/types/fields"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toTableFields(
  rows: { name: string; type?: string; options?: TableField["options"]; table_id?: string }[],
  tableId: string
): TableField[] {
  return rows.map((f, i) => ({
    id: (f as { id?: string }).id ?? f.name,
    table_id: tableId,
    name: f.name,
    type: (f.type || "text") as TableField["type"],
    position: i,
    created_at: "",
    options: f.options,
  }))
}

/** Replace stored link IDs with human-readable labels on each row (in place). */
export async function enrichThemeRowsForDisplay(
  tableId: string,
  supabaseTable: string,
  fieldRows: { name: string; type?: string; options?: TableField["options"]; id?: string }[],
  rows: Record<string, unknown>[]
): Promise<void> {
  if (!rows.length || !fieldRows.length) return

  const tableFields = toTableFields(fieldRows, tableId)
  const gridRows: GridRow[] = rows.map((r) => ({ ...r, id: String(r.id) }))

  const supabase = createClient()
  await computeLookupValues(supabase, tableId, supabaseTable, tableFields, gridRows)

  const linkFields = tableFields.filter((f) => f.type === "link_to_table") as LinkedField[]
  for (const linkField of linkFields) {
    const ids = new Set<string>()
    for (const row of gridRows) {
      const stored = getLinkedFieldValueFromRow(row, linkField)
      for (const id of linkedValueToIds(stored)) ids.add(id)
    }
    if (ids.size === 0) continue

    const labelMap = await resolveLinkedFieldDisplayMap(linkField, Array.from(ids))
    for (const row of gridRows) {
      const stored = getLinkedFieldValueFromRow(row, linkField)
      const idList = linkedValueToIds(stored)
      if (idList.length === 0) continue
      const labels = idList
        .map((id) => labelMap.get(id) ?? labelMap.get(id.toLowerCase()) ?? "")
        .map((s) => s.trim())
        .filter((s) => s && !UUID_RE.test(s))
      if (labels.length === 1) {
        row[linkField.name] = labels[0]
      } else if (labels.length > 1) {
        row[linkField.name] = labels.join(", ")
      }
    }
  }

  for (let i = 0; i < rows.length; i++) {
    Object.assign(rows[i], gridRows[i])
  }
}

export function isUuidLikeDisplayValue(value: unknown): boolean {
  if (typeof value !== "string") return false
  return UUID_RE.test(value.trim())
}
