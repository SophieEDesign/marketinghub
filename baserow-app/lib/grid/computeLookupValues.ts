/**
 * Computes lookup field values for grid rows and merges them into the row objects.
 * Lookup values are not stored in the database; they are derived from the linked
 * field (e.g. link to Core table) and the result field in the lookup table (e.g. Quarter).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TableField } from '@/types/fields'
import { asArray } from '@/lib/utils/asArray'

const BATCH_SIZE = 200 // Max IDs per .in() query to avoid URL length limits

/** Get lookup display value from a row; when metadata field name differs from DB column (e.g. quarter_core_theme vs core_theme), use first non-id column. */
function getLookupDisplayValue(row: Record<string, unknown>, resultFieldName: string): unknown {
  if (row[resultFieldName] != null) return row[resultFieldName]
  const otherKey = Object.keys(row).find((k) => k !== 'id' && k !== 'record_id' && row[k] != null)
  return otherKey != null ? row[otherKey] : undefined
}

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

      const is400 = (err: { message?: string; status?: number; code?: string } | null) =>
        err != null &&
        ((err as { status?: number }).status === 400 ||
          (err as { code?: string }).code === "PGRST116" ||
          String((err as { message?: string }).message ?? "").includes("400"))

      const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

      const rowIdKey = (row: Record<string, unknown>) =>
        row.id != null ? row.id : (row.record_id != null ? row.record_id : null)

      // Fetch in batches to avoid PostgREST URL limits
      for (let i = 0; i < idList.length; i += BATCH_SIZE) {
        const chunk = idList.slice(i, i + BATCH_SIZE)
        let lookupRows: unknown[] | null = null
        let fetchErr: { message?: string; status?: number; code?: string } | null = null

        if (chunk.length === 1 && isUuid(chunk[0])) {
          // Use Supabase client so UUID filter is serialized correctly.
          const tryId = async (selectCols: string) => {
            const r = await supabase
              .from(lookupTableName)
              .select(selectCols)
              .eq("id", chunk[0])
              .maybeSingle()
            return { data: r.data, error: r.error }
          }
          let res = await tryId(`id, ${resultFieldName}`)
          let singleRow = res.data as Record<string, unknown> | null
          let singleErr = res.error as { message?: string; status?: number } | null
          if (is400(singleErr) && !singleRow) {
            res = await tryId("id")
            if (!res.error && res.data) {
              singleRow = res.data as Record<string, unknown>
              singleErr = null
            }
          }
          if (is400(singleErr) && !singleRow) {
            const byRecordId = await supabase
              .from(lookupTableName)
              .select("*")
              .eq("record_id", chunk[0])
              .maybeSingle()
            if (!byRecordId.error && byRecordId.data) {
              singleRow = byRecordId.data as Record<string, unknown>
              singleErr = null
            }
          }
          lookupRows = singleRow != null ? [singleRow] : []
          fetchErr = singleErr
        } else {
          const res = await supabase
            .from(lookupTableName)
            .select(`id, ${resultFieldName}`)
            .in("id", chunk)
          lookupRows = res.data
          fetchErr = res.error
          if (is400(fetchErr as { message?: string; status?: number } | null) && lookupRows == null) {
            let retry = await supabase.from(lookupTableName).select("id").in("id", chunk)
            if (retry.error && (retry.error as { code?: string })?.code === "42703") {
              retry = await supabase.from(lookupTableName).select("*").in("record_id", chunk)
            }
            if (!retry.error && retry.data) {
              lookupRows = retry.data
              fetchErr = null
            }
          }
        }

        if (fetchErr) {
          if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
            console.warn("[computeLookupValues] Error fetching lookup rows:", fetchErr)
          }
          break
        }
        for (const r of asArray(lookupRows)) {
          const row = r as unknown as Record<string, unknown>
          const idVal = rowIdKey(row)
          const id = idVal != null ? String(idVal) : null
          const val = getLookupDisplayValue(row, resultFieldName) ?? (id != null ? id : undefined)
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
