/**
 * Computes lookup field values for grid rows and merges them into the row objects.
 * Lookup values are not stored in the database; they are derived from the linked
 * field (e.g. link to Core table) and the result field in the lookup table (e.g. Quarter).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TableField } from '@/types/fields'
import { asArray } from '@/lib/utils/asArray'

const BATCH_SIZE = 200 // Max IDs per .in() query to avoid URL length limits

export interface GridRow {
  id: string
  [key: string]: unknown
}

/**
 * Enriches rows in place with computed lookup field values.
 * Requires tableId so we can resolve linked/result field names from table_fields.
 */
export async function computeLookupValues(
  supabase: SupabaseClient,
  tableId: string,
  tableName: string,
  fields: TableField[],
  rows: GridRow[]
): Promise<void> {
  const lookupFields = asArray(fields).filter(
    (f): f is TableField => !!f && f.type === 'lookup' && !!f.name
  )
  if (lookupFields.length === 0 || rows.length === 0) return

  for (const field of lookupFields) {
    const lookupFieldId = field.options?.lookup_field_id
    const lookupTableId = field.options?.lookup_table_id
    const lookupResultFieldId = field.options?.lookup_result_field_id

    if (!lookupFieldId || !lookupTableId || !lookupResultFieldId) {
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.warn('[computeLookupValues] Lookup field missing config:', field.name, {
          lookup_field_id: lookupFieldId,
          lookup_table_id: lookupTableId,
          lookup_result_field_id: lookupResultFieldId,
        })
      }
      continue
    }

    try {
      // Resolve linked field name (column in current table that holds the link)
      const { data: linkedField, error: linkedErr } = await supabase
        .from('table_fields')
        .select('name')
        .eq('id', lookupFieldId)
        .eq('table_id', tableId)
        .single()

      if (linkedErr || !linkedField?.name) {
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn('[computeLookupValues] Linked field not found:', lookupFieldId, linkedErr)
        }
        continue
      }

      const linkedFieldName = linkedField.name

      // Lookup table and result field name
      const { data: lookupTable, error: tableErr } = await supabase
        .from('tables')
        .select('supabase_table')
        .eq('id', lookupTableId)
        .single()

      if (tableErr || !lookupTable?.supabase_table) {
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn('[computeLookupValues] Lookup table not found:', lookupTableId, tableErr)
        }
        continue
      }

      const { data: resultField, error: resultErr } = await supabase
        .from('table_fields')
        .select('name')
        .eq('id', lookupResultFieldId)
        .eq('table_id', lookupTableId)
        .single()

      if (resultErr || !resultField?.name) {
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn('[computeLookupValues] Lookup result field not found:', lookupResultFieldId, resultErr)
        }
        continue
      }

      const resultFieldName = resultField.name
      const lookupTableName = lookupTable.supabase_table as string

      // Collect all linked IDs from rows
      const allIds = new Set<string>()
      for (const row of rows) {
        const raw = row[linkedFieldName]
        if (raw == null) continue
        const ids = Array.isArray(raw) ? raw : [raw]
        ids.forEach((id: unknown) => {
          if (id && typeof id === 'string') allIds.add(id)
        })
      }

      if (allIds.size === 0) {
        rows.forEach((r) => (r[field.name] = null))
        continue
      }

      const idList = Array.from(allIds)
      const idToValue = new Map<string, unknown>()

      // Fetch in batches to avoid PostgREST URL limits
      for (let i = 0; i < idList.length; i += BATCH_SIZE) {
        const chunk = idList.slice(i, i + BATCH_SIZE)
        const { data: lookupRows, error: fetchErr } = await supabase
          .from(lookupTableName)
          .select(`id, ${resultFieldName}`)
          .in('id', chunk)

        if (fetchErr) {
          if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            console.warn('[computeLookupValues] Error fetching lookup rows:', fetchErr)
          }
          break
        }
        for (const r of asArray(lookupRows)) {
          const row = r as unknown as { id: string } & Record<string, unknown>
          const id = row.id
          const val = row[resultFieldName]
          if (id != null) idToValue.set(id, val)
        }
      }

      // Enrich each row: single linked ID -> single value, multiple IDs -> array
      for (const row of rows) {
        const raw = row[linkedFieldName]
        if (raw == null) {
          row[field.name] = null
          continue
        }
        const ids = Array.isArray(raw) ? raw : [raw]
        const validIds = ids.filter((id): id is string => id != null && typeof id === 'string')
        const values = validIds
          .map((id) => idToValue.get(id))
          .filter((v) => v !== null && v !== undefined)
        if (values.length === 0) {
          row[field.name] = null
        } else if (validIds.length > 1) {
          row[field.name] = values
        } else {
          row[field.name] = values[0]
        }
      }
    } catch (err) {
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.warn('[computeLookupValues] Error computing lookup for field:', field.name, err)
      }
    }
  }
}
