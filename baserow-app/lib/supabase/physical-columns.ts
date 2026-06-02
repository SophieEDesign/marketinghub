import type { SupabaseClient } from '@supabase/supabase-js'
import type { TableField } from '@/types/fields'
import { toPostgrestColumn } from '@/lib/supabase/postgrest'
import type { FilterConfig } from '@/lib/interface/filters'

const VIRTUAL_FIELD_TYPES = new Set(['formula', 'lookup'])

/** Load physical column names for a dynamic table via RPC (best-effort). */
export async function fetchPhysicalColumns(
  supabase: SupabaseClient,
  tableName: string
): Promise<Set<string> | null> {
  if (!tableName?.trim()) return null
  try {
    const { data: cols, error } = await supabase.rpc('get_table_columns', {
      table_name: tableName,
    })
    if (error || !Array.isArray(cols)) return null
    return new Set(
      cols.map((c: { column_name?: string }) => String(c?.column_name ?? '')).filter(Boolean)
    )
  } catch {
    return null
  }
}

/** Metadata fields that are stored on the physical table (excludes formula/lookup). */
export function getMetadataPhysicalFieldNames(tableFields: TableField[]): Set<string> {
  const names = new Set<string>()
  for (const f of tableFields) {
    if (!f?.name || !f.type || VIRTUAL_FIELD_TYPES.has(f.type)) continue
    const col = toPostgrestColumn(f.name)
    if (col) names.add(col)
  }
  return names
}

export function filterConfigsToQueryableColumns(
  filters: FilterConfig[],
  tableFields: TableField[],
  physicalColumns: Set<string> | null
): FilterConfig[] {
  const safe = Array.isArray(filters) ? filters : []
  const metadataPhysical = getMetadataPhysicalFieldNames(tableFields)
  return safe.filter((f) => {
    const col = toPostgrestColumn(f.field)
    if (!col) return false
    if (physicalColumns) return hasPhysicalColumn(physicalColumns, col)
    return metadataPhysical.has(col)
  })
}

export function filterViewFiltersToQueryableColumns<
  T extends { field_name?: string; field_id?: string }
>(
  viewFilters: T[],
  tableFields: TableField[],
  physicalColumns: Set<string> | null
): T[] {
  const metadataPhysical = getMetadataPhysicalFieldNames(tableFields)
  return (Array.isArray(viewFilters) ? viewFilters : []).filter((f) => {
    const raw = f.field_name || f.field_id
    const col = toPostgrestColumn(String(raw ?? ''))
    if (!col) return false
    if (physicalColumns) return hasPhysicalColumn(physicalColumns, col)
    return metadataPhysical.has(col)
  })
}

export function filterSortsToQueryableColumns<
  T extends { field_name?: string; field_id?: string }
>(
  sorts: T[],
  tableFields: TableField[],
  physicalColumns: Set<string> | null
): T[] {
  const metadataPhysical = getMetadataPhysicalFieldNames(tableFields)
  return (Array.isArray(sorts) ? sorts : []).filter((s) => {
    const raw = s.field_name || s.field_id
    const col = toPostgrestColumn(String(raw ?? ''))
    if (!col) return false
    if (physicalColumns) return hasPhysicalColumn(physicalColumns, col)
    return metadataPhysical.has(col)
  })
}

export function hasPhysicalColumnName(physicalColumns: Set<string> | null, name: string): boolean {
  if (!physicalColumns) return true
  return hasPhysicalColumn(physicalColumns, name)
}

function hasPhysicalColumn(physicalColumns: Set<string>, name: string): boolean {
  const target = name.toLowerCase()
  for (const col of physicalColumns) {
    if (col.toLowerCase() === target) return true
  }
  return false
}

export const SOFT_DELETE_COLUMN = 'deleted_at'

/** Whether the table supports soft delete (unknown physical schema → assume yes). */
export function supportsSoftDelete(physicalColumns: Set<string> | null): boolean {
  if (!physicalColumns) return true
  return hasPhysicalColumn(physicalColumns, SOFT_DELETE_COLUMN)
}

/** Payload for soft-deleting a row via UPDATE (not hard DELETE). */
export function buildSoftDeletePatch(): Record<string, string> {
  return { [SOFT_DELETE_COLUMN]: new Date().toISOString() }
}

export function softDeleteNotSupportedMessage(tableName?: string | null): string {
  const target = tableName ? ` "${tableName}"` : ''
  return `This table${target} does not have a deleted_at column. Run database migrations or add deleted_at to enable record deletion.`
}

/** Apply soft-delete filter only when the column exists (or when unknown). */
export function applySoftDeleteFilter<T extends { is: (col: string, val: null) => T }>(
  query: T,
  physicalColumns: Set<string> | null
): T {
  if (physicalColumns && !hasPhysicalColumn(physicalColumns, SOFT_DELETE_COLUMN)) return query
  return query.is(SOFT_DELETE_COLUMN, null)
}

export function extractMissingColumnFromPostgrestError(err: unknown): string | null {
  const errorObj = err as { message?: string; details?: string } | null
  const msg = String(errorObj?.message || errorObj?.details || '').toLowerCase()
  const m1 = msg.match(/could not find the '([^']+)' column/)
  if (m1?.[1]) return m1[1]
  const m2 = msg.match(/column "([^"]+)" (?:of relation .* )?does not exist/)
  if (m2?.[1]) return m2[1]
  const m3 = msg.match(/column ([a-z0-9_]+) does not exist/)
  if (m3?.[1]) return m3[1]
  return null
}
