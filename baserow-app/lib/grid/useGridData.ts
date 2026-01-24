import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { TableField } from '@/types/fields'
import { asArray } from '@/lib/utils/asArray'
import { applyFiltersToQuery, type FilterConfig } from '@/lib/interface/filters'
import { buildSelectClause, toPostgrestColumn } from '@/lib/supabase/postgrest'
import { isAbortError } from '@/lib/api/error-handling'
import { useToast } from '@/components/ui/use-toast'

export interface GridRow {
  id: string
  [key: string]: unknown
}

export interface UseGridDataOptions {
  tableName: string
  /** Optional: enables server-side schema self-heal for this table */
  tableId?: string
  fields?: TableField[]
  filters?: FilterConfig[]
  sorts?: Array<{ field: string; direction: 'asc' | 'desc' }>
  limit?: number
  /** Optional: callback for error notifications (e.g., toast) */
  onError?: (error: unknown, message: string) => void
}

export interface UseGridDataReturn {
  rows: GridRow[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  retry: () => Promise<void> // Retry loading data after an error
  updateCell: (rowId: string, fieldName: string, value: unknown) => Promise<void>
  insertRow: (data: Record<string, any>) => Promise<GridRow | null>
  deleteRow: (rowId: string) => Promise<void>
  /** Physical columns that exist in the database (null if not yet loaded) */
  physicalColumns: Set<string> | null
}

// CRITICAL: Reduced default limit from 10000 to 500 to prevent memory exhaustion and crashes
// Large datasets should use pagination instead of loading everything at once
const DEFAULT_LIMIT = 500
const MAX_SAFE_LIMIT = 2000 // Hard cap to prevent crashes

// NOTE: PostgREST select/order must use unquoted identifiers; see `lib/supabase/postgrest`.

export function useGridData({
  tableName,
  tableId,
  fields = [],
  filters = [],
  sorts = [],
  limit = DEFAULT_LIMIT,
  onError,
}: UseGridDataOptions): UseGridDataReturn {
  const { toast } = useToast()
  const [rows, setRows] = useState<GridRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Prevent concurrent loads that could cause memory issues
  const isLoadingRef = useRef(false)

  // Cache physical columns to prevent PostgREST 400s when metadata drifts from schema.
  // (E.g. selecting/filtering on a column that doesn't exist in the physical table.)
  const physicalColumnsRef = useRef<Set<string> | null>(null)
  const physicalColumnsTableRef = useRef<string | null>(null)
  const missingColumnsRef = useRef<Set<string>>(new Set())
  const missingColumnsTableRef = useRef<string | null>(null)

  const refreshPhysicalColumns = useCallback(
    async (force = false) => {
      if (!tableName) return
      if (!force && physicalColumnsTableRef.current === tableName && physicalColumnsRef.current !== null) {
        return
      }
      physicalColumnsTableRef.current = tableName
      physicalColumnsRef.current = null
      try {
        const { data: cols, error: colsError } = await supabase.rpc('get_table_columns', {
          table_name: tableName,
        })
        if (!colsError && Array.isArray(cols)) {
          physicalColumnsRef.current = new Set(
            cols.map((c: { column_name?: string }) => String(c?.column_name ?? '')).filter(Boolean)
          )
        }
      } catch {
        // Non-fatal: if RPC isn't available, we fall back to best-effort behaviour.
        physicalColumnsRef.current = null
      }
    },
    [tableName]
  )

  function noteMissingColumnFromError(err: unknown): string | null {
    const errorObj = err as { message?: string; details?: string } | null
    const msg = String(errorObj?.message || errorObj?.details || '').toLowerCase()

    // Common PostgREST patterns:
    // - Could not find the 'name' column of 'table_x' in the schema cache
    // - column "content_type" does not exist
    const m1 = msg.match(/could not find the '([^']+)' column/)
    if (m1?.[1]) return m1[1]
    const m2 = msg.match(/column\\s+\\"([^\\"]+)\\"\\s+does\\s+not\\s+exist/)
    if (m2?.[1]) return m2[1]
    return null
  }

  function formatPostgrestError(err: unknown): string {
    if (!err) return 'Unknown error'
    const errorObj = err as { code?: string | number; message?: string; details?: string; hint?: string } | null
    const parts = [
      errorObj?.code ? `code=${errorObj.code}` : null,
      errorObj?.message ? `message=${errorObj.message}` : null,
      errorObj?.details ? `details=${errorObj.details}` : null,
      errorObj?.hint ? `hint=${errorObj.hint}` : null,
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(' | ') : String(err)
  }

  function normalizeUpdateValue(fieldName: string, value: unknown): unknown {
    // Avoid sending `undefined` (it becomes `{}` and can cause PostgREST 400s).
    let v: unknown = value === undefined ? null : value
    // JSON.stringify turns NaN/Infinity into null; do it explicitly for clarity.
    if (typeof v === 'number' && (!Number.isFinite(v) || Number.isNaN(v))) v = null

    const safeFields = asArray<TableField>(fields)
    const field = safeFields.find((f) => f && typeof f === 'object' && (f as TableField).name === fieldName)
    const type = (field as TableField | undefined)?.type

    if (!type) return v

    switch (type) {
      case 'number':
      case 'percent':
      case 'currency': {
        if (v === '') return null
        if (typeof v === 'string') {
          const trimmed = v.trim()
          if (!trimmed) return null
          const n = Number(trimmed)
          return Number.isFinite(n) ? n : null
        }
        return v
      }

      case 'checkbox': {
        if (typeof v === 'string') {
          const t = v.trim().toLowerCase()
          if (t === 'true') return true
          if (t === 'false') return false
        }
        return !!v
      }

      case 'multi_select': {
        if (v == null) return []
        if (Array.isArray(v)) return v.filter((x) => x !== null && x !== undefined && x !== '').map(String)
        if (typeof v === 'string') {
          const trimmed = v.trim()
          if (!trimmed) return []
          return trimmed
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        }
        return v
      }

      case 'single_select': {
        if (v == null) return null
        return String(v)
      }

      case 'date': {
        if (v === '') return null
        return v
      }

      case 'link_to_table': {
        const maybeParseJsonArrayString = (s: string): unknown[] | null => {
          const trimmed = s.trim()
          if (!(trimmed.startsWith('[') && trimmed.endsWith(']'))) return null
          try {
            const parsed = JSON.parse(trimmed)
            return Array.isArray(parsed) ? parsed : null
          } catch {
            return null
          }
        }

        const toId = (x: unknown): string | null => {
          if (x == null || x === '') return null
          if (typeof x === 'string') {
            // Some UI paths accidentally stringify arrays for link fields, e.g. `["uuid"]`.
            // Coerce that back into a single uuid to avoid Postgres 22P02.
            const parsedArr = maybeParseJsonArrayString(x)
            if (parsedArr && parsedArr.length > 0) {
              const first = parsedArr[0]
              if (first == null || first === '') return null
              return String(first)
            }
            return x
          }
          if (typeof x === 'object' && x && 'id' in x) return String((x as { id: unknown }).id)
          return String(x)
        }
        // IMPORTANT:
        // Most physical tables store `link_to_table` as a single `uuid` column (one-to-one).
        // Some configurations may represent multi-link relationships (uuid[]). We must align the
        // payload shape with the relationship configuration to avoid Postgres cast errors (22P02).
        const relationshipType = (field as any)?.options?.relationship_type as
          | 'one-to-one'
          | 'one-to-many'
          | 'many-to-many'
          | undefined
        const maxSelections = (field as any)?.options?.max_selections as number | undefined
        const isMulti =
          relationshipType === 'one-to-many' ||
          relationshipType === 'many-to-many' ||
          (typeof maxSelections === 'number' && maxSelections > 1)

        if (isMulti) {
          if (v == null) return null
          if (Array.isArray(v)) return v.map(toId).filter(Boolean)
          const id = toId(v)
          return id ? [id] : null
        }

        // Single-link: always normalize to a single UUID (or null).
        if (Array.isArray(v)) return toId(v[0])
        return toId(v)
      }

      default:
        return v
    }
  }
  
  // Store filters and sorts in refs to avoid dependency issues
  // Only update when content actually changes (via stringified comparison)
  const filtersRef = useRef(filters)
  const sortsRef = useRef(sorts)
  
  // Memoize filters and sorts strings to detect actual content changes
  // Only re-compute when the actual content changes, not when references change
  const filtersString = useMemo(() => JSON.stringify(filters), [filters])
  const sortsString = useMemo(() => JSON.stringify(sorts), [sorts])
  
  // Update refs when content changes (but not on every render)
  useEffect(() => {
    filtersRef.current = filters
  }, [filtersString])
  
  useEffect(() => {
    sortsRef.current = sorts
  }, [sortsString])
  
  // Cap limit to prevent memory exhaustion
  const safeLimit = limit > MAX_SAFE_LIMIT ? MAX_SAFE_LIMIT : limit

  const loadData = useCallback(async () => {
    if (!tableName) {
      setLoading(false)
      return
    }
    
    // Prevent concurrent loads
    if (isLoadingRef.current) {
      console.warn('[useGridData] Load already in progress, skipping duplicate request')
      return
    }

    isLoadingRef.current = true
    setLoading(true)
    setError(null)

    try {
      // Reset missing-column cache when table changes
      if (missingColumnsTableRef.current !== tableName) {
        missingColumnsTableRef.current = tableName
        missingColumnsRef.current = new Set()
      }

      // Load physical columns (once per tableName) so we can avoid PostgREST 400s.
      await refreshPhysicalColumns()

      const maybeSyncSchema = async () => {
        if (!tableId) return false
        try {
          const res = await fetch(`/api/tables/${tableId}/sync-schema`, { method: 'POST' })
          if (!res.ok) return false
          return true
        } catch {
          return false
        }
      }

      const isTableMissingError = (err: unknown): boolean => {
        // Supabase/PostgREST often uses 404 or codes like 42P01 for missing relations.
        const errorObj = err as { status?: number; code?: string; message?: string } | null
        const status = errorObj?.status
        const code = String(errorObj?.code || '')
        const msg = String(errorObj?.message || '').toLowerCase()
        return (
          status === 404 ||
          code === '42P01' ||
          msg.includes('does not exist') ||
          msg.includes('could not find the table') ||
          msg.includes('table not found')
        )
      }

      const runQuery = async (attempt: number): Promise<null> => {
        // Use refs to get current filters/sorts without causing dependency issues
        const currentFilters = filtersRef.current
        const currentSorts = sortsRef.current
      
      // If field metadata is provided, avoid over-fetching.
      // Only select physical columns; virtual fields (formula/lookup) are computed elsewhere.
        const safeFields = asArray<TableField>(fields)
        const physicalFieldNames = safeFields
          .filter((f) => f && typeof f === 'object' && f.name && f.type !== 'formula' && f.type !== 'lookup')
          .map((f) => f.name)

        // Exclude columns that we've learned are missing from previous 400s.
        const learnedMissing = missingColumnsRef.current
        const withoutLearnedMissing = physicalFieldNames.filter((n) => !learnedMissing.has(String(n)))

        // If we know the physical table columns, drop metadata fields that don't exist.
        const physicalCols = physicalColumnsRef.current
        const existingPhysicalFieldNames = physicalCols
          ? withoutLearnedMissing.filter((n) => physicalCols.has(n))
          : withoutLearnedMissing

        const invalidFieldNames = physicalFieldNames.filter((n) => !toPostgrestColumn(n))
      if (invalidFieldNames.length > 0) {
        console.warn(
          '[useGridData] Skipping invalid column names (would cause PostgREST 400):',
          invalidFieldNames
        )
      }

        const selectClause = buildSelectClause(existingPhysicalFieldNames, { includeId: true, fallback: '*' })

        let query = supabase.from(tableName).select(selectClause)

      // Apply filters using shared unified filter engine (supports date operators, selects, etc.)
        const safeFilterConfigs = asArray<FilterConfig>(currentFilters as FilterConfig[]).filter(
        (f) => !!f && typeof (f as FilterConfig).field === 'string' && typeof (f as FilterConfig).operator === 'string'
      )
      if (safeFilterConfigs.length > 0) {
        // If we know the physical columns, skip filters on missing columns.
        const filteredConfigs = physicalCols
          ? safeFilterConfigs.filter((f) => {
              const col = toPostgrestColumn((f as any).field)
              return !!col && physicalCols.has(col)
            })
          : safeFilterConfigs
              // Best-effort: also skip learned-missing columns even if we don't have physicalCols.
              .filter((f) => !learnedMissing.has(String((f as any).field)))

        const normalizedFields = safeFields.map((f) => ({
          name: f.name,
          type: f.type,
          id: f.id,
          options: (f as any).options,
        }))
          query = applyFiltersToQuery(query, filteredConfigs, normalizedFields as any)
      }

      // Apply sorts
        currentSorts.forEach((sort) => {
        const col = toPostgrestColumn(sort.field)
        if (!col) {
          console.warn('[useGridData] Skipping sort on invalid column:', sort.field)
          return
        }
        if (physicalCols && !physicalCols.has(col)) {
          console.warn('[useGridData] Skipping sort on missing physical column:', sort.field)
          return
        }
        if (!physicalCols && learnedMissing.has(col)) {
          console.warn('[useGridData] Skipping sort on learned-missing column:', sort.field)
          return
        }
        query = query.order(col, { ascending: sort.direction === 'asc' })
      })

      // Apply limit with safety cap
      query = query.limit(safeLimit)
      
      if (limit > MAX_SAFE_LIMIT) {
        console.warn(`[useGridData] Limit ${limit} exceeds safe maximum ${MAX_SAFE_LIMIT}, capping to ${MAX_SAFE_LIMIT} to prevent crashes`)
      }

        const { data, error: queryError } = await query

        if (queryError) {
          // Self-heal: if the physical table is missing (common when metadata exists but
          // table creation failed), attempt a server-side schema sync once.
          if (attempt === 0 && isTableMissingError(queryError)) {
            const synced = await maybeSyncSchema()
            if (synced) {
              await refreshPhysicalColumns(true)
              return await runQuery(attempt + 1)
            }
          }
          // If we hit a PostgREST 400 due to schema drift, learn the missing column and retry once.
          const missing = noteMissingColumnFromError(queryError)
          if (missing) {
            missingColumnsRef.current.add(missing)
            // Revalidate physical columns after schema changes (rename/delete/type change).
            await refreshPhysicalColumns(true)
            if (attempt === 0) {
              return await runQuery(attempt + 1)
            }
          }
          throw queryError
        }

        // CRITICAL: Normalize data to array
        const normalizedRows = asArray<GridRow>(data)
        setRows(normalizedRows)
        return null
      }

      await runQuery(0)
    } catch (err: unknown) {
      if (isAbortError(err)) return
      const errorMessage = (err as { message?: string })?.message || 'Failed to load data'
      console.error('Error loading grid data:', err)
      setError(errorMessage)
      setRows([])
      // Notify parent component of error for toast display
      if (onError) {
        onError(err, errorMessage)
      }
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
    // CRITICAL: Only depend on stringified versions to prevent infinite loops
    // Refs ensure we always use latest values without causing re-renders
  }, [tableName, tableId, filtersString, refreshPhysicalColumns, safeLimit, sortsString, onError, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const updateCell = useCallback(
    async (rowId: string, fieldName: string, value: unknown) => {
      try {
        // CRITICAL: First check if the field exists in metadata before attempting any update
        // This prevents errors when trying to update deleted fields
        const safeFields = asArray<TableField>(fields)
        const fieldExists = safeFields.some(f => f && typeof f === 'object' && f.name === fieldName)
        
        if (!fieldExists) {
          throw new Error(
            `Cannot update "${fieldName}" because this field has been deleted or renamed. ` +
              `Please refresh the page to see the current field list.`
          )
        }

        // If the column name isn't a safe PostgREST identifier, UPDATE may fail depending on how
        // the physical table was created (quoted identifiers, etc.). Surface a clearer error.
        const safeColumn = toPostgrestColumn(fieldName)
        if (!safeColumn) {
          throw new Error(
            `This field cannot be updated via the API because its column name is not a safe identifier: "${fieldName}". ` +
              `Rename the field to a simple snake_case name (letters/numbers/_), or ensure your backend supports quoted column updates.`
          )
        }

        const physicalCols = physicalColumnsRef.current
        if (physicalCols && !physicalCols.has(safeColumn)) {
          // Self-heal: try to sync schema and refresh physical columns once.
          if (tableId) {
            try {
              const res = await fetch(`/api/tables/${tableId}/sync-schema`, { method: 'POST' })
              const syncResult = await res.json().catch(() => ({}))
              
              if (res.ok && syncResult.success) {
                console.log('[useGridData] Schema sync result:', syncResult)
                // Wait a moment for PostgREST cache to refresh
                await new Promise(resolve => setTimeout(resolve, 500))
                await refreshPhysicalColumns(true)
                
                // Check if the column was added or if it's still missing
                if (syncResult.missingPhysicalColumns && syncResult.missingPhysicalColumns.includes(safeColumn)) {
                  throw new Error(
                    `Cannot update "${safeColumn}" on "${tableName}" because that column does not exist on the physical table. ` +
                      `The field "${fieldName}" exists in metadata but the physical column could not be created. ` +
                      `Please refresh the page or contact support if the issue persists. ` +
                      `(Table ID: ${tableId})`
                  )
                }
              } else {
                // Log the error but continue to check if column exists
                const status = res.status
                const errorMsg = syncResult.message || syncResult.error || 'Unknown error'
                console.warn('[useGridData] Schema sync failed:', { status, error: errorMsg })
                
                // If sync failed, we still need to check if the column exists
                // It might have been created manually or in a previous attempt
                await refreshPhysicalColumns(true)
              }
            } catch (syncError: unknown) {
              console.warn('[useGridData] Schema sync error:', syncError)
              // Refresh columns anyway in case they were created
              await refreshPhysicalColumns(true)
            }
          }

          const refreshedCols = physicalColumnsRef.current
          if (refreshedCols && !refreshedCols.has(safeColumn)) {
            // Field exists in metadata but column is missing - this is a schema drift issue
            throw new Error(
              `Cannot update "${fieldName}" on "${tableName}" because that column does not exist on the physical table. ` +
                `The field "${fieldName}" may have been deleted or renamed. Please refresh the page to see the current field list.`
            )
          }
        }

        const normalizedValue = normalizeUpdateValue(fieldName, value)

        let finalSavedValue: unknown = normalizedValue

        const doUpdate = async (val: unknown) => {
          return await supabase.from(tableName).update({ [safeColumn]: val }).eq('id', rowId)
        }

        let { error: updateError } = await doUpdate(finalSavedValue)

        // Compatibility rescue:
        // Some existing tables have link_to_table columns physically created as `uuid` even though
        // the field is configured as multi-link (and the UI returns an array). In that case Postgres
        // throws 22P02 "invalid input syntax for type uuid". If the user only selected one value,
        // we can safely retry with the first element so inline edit doesn't hard-fail.
        if (
          updateError?.code === '22P02' &&
          Array.isArray(finalSavedValue) &&
          String(updateError?.message || '').toLowerCase().includes('invalid input syntax for type uuid')
        ) {
          if (finalSavedValue.length <= 1) {
            finalSavedValue = finalSavedValue[0] ?? null
            const retry = await doUpdate(finalSavedValue)
            updateError = retry.error
          } else {
            throw new Error(
              `This field is configured to allow multiple linked records, but the underlying column ` +
                `is a single uuid. Please change the field to "One to One" (single) or migrate the ` +
                `column to uuid[] before saving multiple values.`
            )
          }
        }

        if (updateError) {
          // Common root cause for "inline editing doesn't save" on newly created dynamic tables:
          // missing GRANTs for authenticated on the physical table.
          const msg = String(updateError.message || '')
          if (msg.toLowerCase().includes('permission denied')) {
            throw new Error(
              `Permission denied updating table "${tableName}". ` +
                `If this is a dynamic Core Data table, ensure it grants SELECT/INSERT/UPDATE/DELETE to the authenticated role ` +
                `(see migration: supabase/migrations/grant_access_to_dynamic_data_tables.sql). Original error: ${msg}`
            )
          }

          // If PostgREST complains about schema cache / missing columns, surface a clearer error.
          const missing = noteMissingColumnFromError(updateError)
          if (missing) {
            throw new Error(
              `Failed to update "${safeColumn}" on "${tableName}" because PostgREST reports a missing column "${missing}". ` +
                `If this column was recently created/renamed, wait a moment and reload; otherwise ensure the physical table matches the field definition. ` +
                `Original error: ${formatPostgrestError(updateError)}`
            )
          }

          throw new Error(`Failed to update "${safeColumn}" on "${tableName}": ${formatPostgrestError(updateError)}`)
        }

        // Optimistically update local state
        setRows((prevRows) =>
          prevRows.map((row) =>
            row.id === rowId ? { ...row, [fieldName]: finalSavedValue } : row
          )
        )
      } catch (err: unknown) {
        console.error('Error updating cell:', {
          tableName,
          rowId,
          fieldName,
          value,
          error: err,
        })
        // Reload on error to sync with server
        await loadData()
        // Show error toast
        const errorMessage = err instanceof Error ? err.message : String(err)
        if (onError) {
          onError(err, errorMessage)
        } else {
          toast({
            variant: "destructive",
            title: "Failed to update cell",
            description: errorMessage,
          })
        }
        throw err
      }
    },
    [tableName, tableId, loadData, onError, toast]
  )

  const insertRow = useCallback(
    async (data: Record<string, any>): Promise<GridRow | null> => {
      try {
        // Some Supabase/PostgREST setups reject INSERT payloads with no columns (e.g. `{}`),
        // even if the table has defaults/triggers. Ensure at least one safe column is present.
        // `created_at` is part of our standardized audit fields across dynamic tables.
        const payload =
          data && Object.keys(data).length > 0
            ? data
            : { created_at: new Date().toISOString() }

        const { data: newRow, error: insertError } = await supabase
          .from(tableName)
          .insert([payload])
          .select()
          .single()

        if (insertError) {
          throw insertError
        }

        setRows((prevRows) => [...prevRows, newRow])
        return newRow
      } catch (err: unknown) {
        console.error('Error inserting row:', err)
        throw err
      }
    },
    [tableName]
  )

  const deleteRow = useCallback(
    async (rowId: string) => {
      try {
        const { error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .eq('id', rowId)

        if (deleteError) {
          throw deleteError
        }

        setRows((prevRows) => prevRows.filter((row) => row.id !== rowId))
      } catch (err: unknown) {
        console.error('Error deleting row:', err)
        const errorMessage = err instanceof Error ? err.message : String(err)
        if (onError) {
          onError(err, errorMessage)
        } else {
          toast({
            variant: "destructive",
            title: "Failed to delete row",
            description: errorMessage,
          })
        }
        throw err
      }
    },
    [tableName, onError, toast]
  )

  const refresh = useCallback(async () => {
    await loadData()
  }, [loadData])

  const retry = useCallback(async () => {
    setError(null)
    await loadData()
  }, [loadData])

  return {
    rows,
    loading,
    error,
    refresh,
    retry,
    updateCell,
    insertRow,
    deleteRow,
    physicalColumns: physicalColumnsRef.current,
  }
}
