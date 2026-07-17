import type { FilterConfig } from "@/lib/interface/filters"

/**
 * When a page uses record_context (left rail), merge these filters into data-view blocks
 * so child grids/lists narrow to rows linked to the selected parent record.
 *
 * Block config (view_blocks.config): `record_context_link: { field, parent_table_id?, operator? }`
 *
 * - `parent_table_id` (recommended): UUID of `tables.id` for the record_context source table.
 * - `operator`: `equal` (default), `is_any_of`, or `contains` (array / multi-select style storage).
 */
export type RecordContextLinkConfig = {
  field: string
  parent_table_id?: string
  operator?: "equal" | "is_any_of" | "contains"
}

export function buildRecordContextFilters(
  link: RecordContextLinkConfig | null | undefined,
  recordId: string | null | undefined,
  recordTableId: string | null | undefined
): FilterConfig[] {
  if (!link?.field || !recordId?.trim()) return []
  if (!recordTableId) return []
  if (link.parent_table_id && link.parent_table_id !== recordTableId) return []

  const op = link.operator ?? "equal"
  if (op === "is_any_of") {
    return [{ field: link.field, operator: "is_any_of", value: [recordId] }]
  }
  if (op === "contains") {
    return [{ field: link.field, operator: "contains", value: recordId }]
  }
  return [{ field: link.field, operator: "equal", value: recordId }]
}
