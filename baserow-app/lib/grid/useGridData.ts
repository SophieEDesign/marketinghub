import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { TableField } from '@/types/fields'
import { asArray } from '@/lib/utils/asArray'
import { applyFiltersToQuery, type FilterConfig } from '@/lib/interface/filters'
import { buildSelectClause, toPostgrestColumn } from '@/lib/supabase/postgrest'

export interface GridRow {
  id: string
  [key: string]: any
}

export interface UseGridDataOptions {
  tableName: string
  fields?: TableField[]
  filters?: FilterConfig[]
  sorts?: Array<{ field: string; direction: 'asc' | 'desc' }>
  limit?: number
}

export interface UseGridDataReturn {
  rows: GridRow[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  updateCell: (rowId: string, fieldName: string, value: any) => Promise<void>
  insertRow: (data: Record<string, any>) => Promise<GridRow | null>
  deleteRow: (rowId: string) => Promise<void>
}

// CRITICAL: Reduced default limit from 10000 to 500 to prevent memory exhaustion and crashes
// Large datasets should use pagination instead of loading everything at once
const DEFAULT_LIMIT = 500
const MAX_SAFE_LIMIT = 2000 // Hard cap to prevent crashes

// NOTE: PostgREST select/order must use unquoted identifiers; see `lib/supabase/postgrest`.

export function useGridData({
  tableName,
  fields = [],
  filters = [],
  sorts = [],
  limit = DEFAULT_LIMIT,
}: UseGridDataOptions): UseGridDataReturn {
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

  function noteMissingColumnFromError(err: any): string | null {
    const msg = String(err?.message || err?.details || '').toLowerCase()

    // Common PostgREST patterns:
    // - Could not find the 'name' column of 'table_x' in the schema cache
    // - column "content_type" does not exist
    const m1 = msg.match(/could not find the '([^']+)' column/)
    if (m1?.[1]) return m1[1]
    const m2 = msg.match(/column\\s+\\"([^\\"]+)\\"\\s+does\\s+not\\s+exist/)
    if (m2?.[1]) return m2[1]
    return null
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
      if (physicalColumnsTableRef.current !== tableName) {
        physicalColumnsTableRef.current = tableName
        physicalColumnsRef.current = null
        try {
          const { data: cols, error: colsError } = await supabase.rpc('get_table_columns', {
            table_name: tableName,
          })
          if (!colsError && Array.isArray(cols)) {
            physicalColumnsRef.current = new Set(
              cols.map((c: any) => String(c?.column_name ?? '')).filter(Boolean)
            )
          }
        } catch {
          // Non-fatal: if RPC isn't available, we fall back to best-effort behaviour.
          physicalColumnsRef.current = null
        }
      }

      const runQuery = async (attempt: number): Promise<any> => {
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

        let query: any = supabase.from(tableName).select(selectClause)

      // Apply filters using shared unified filter engine (supports date operators, selects, etc.)
        const safeFilterConfigs = asArray<FilterConfig>(currentFilters as any).filter(
        (f) => !!f && typeof (f as any).field === 'string' && typeof (f as any).operator === 'string'
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
          // If we hit a PostgREST 400 due to schema drift, learn the missing column and retry once.
          const missing = noteMissingColumnFromError(queryError)
          if (missing && attempt === 0) {
            missingColumnsRef.current.add(missing)
            return await runQuery(attempt + 1)
          }
          throw queryError
        }

        // CRITICAL: Normalize data to array
        const normalizedRows = asArray<GridRow>(data)
        setRows(normalizedRows)
        return null
      }

      await runQuery(0)
    } catch (err: any) {
      console.error('Error loading grid data:', err)
      setError(err.message || 'Failed to load data')
      setRows([])
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
    // CRITICAL: Only depend on stringified versions to prevent infinite loops
    // Refs ensure we always use latest values without causing re-renders
  }, [tableName, filtersString, sortsString, safeLimit])

  useEffect(() => {
    loadData()
  }, [loadData])

  const updateCell = useCallback(
    async (rowId: string, fieldName: string, value: any) => {
      try {
        // If the column name isn't a safe PostgREST identifier, UPDATE may fail depending on how
        // the physical table was created (quoted identifiers, etc.). Surface a clearer error.
        const safeColumn = toPostgrestColumn(fieldName)
        if (!safeColumn) {
          throw new Error(
            `This field cannot be updated via the API because its column name is not a safe identifier: "${fieldName}". ` +
              `Rename the field to a simple snake_case name (letters/numbers/_), or ensure your backend supports quoted column updates.`
          )
        }

        const { error: updateError } = await supabase
          .from(tableName)
          .update({ [safeColumn]: value })
          .eq('id', rowId)

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
          throw updateError
        }

        // Optimistically update local state
        setRows((prevRows) =>
          prevRows.map((row) =>
            row.id === rowId ? { ...row, [fieldName]: value } : row
          )
        )
      } catch (err: any) {
        console.error('Error updating cell:', err)
        // Reload on error to sync with server
        await loadData()
        throw err
      }
    },
    [tableName, loadData]
  )

  const insertRow = useCallback(
    async (data: Record<string, any>): Promise<GridRow | null> => {
      try {
        const { data: newRow, error: insertError } = await supabase
          .from(tableName)
          .insert([data])
          .select()
          .single()

        if (insertError) {
          throw insertError
        }

        setRows((prevRows) => [...prevRows, newRow])
        return newRow
      } catch (err: any) {
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
      } catch (err: any) {
        console.error('Error deleting row:', err)
        throw err
      }
    },
    [tableName]
  )

  const refresh = useCallback(async () => {
    await loadData()
  }, [loadData])

  return {
    rows,
    loading,
    error,
    refresh,
    updateCell,
    insertRow,
    deleteRow,
  }
}
