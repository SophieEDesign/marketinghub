import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { TableField } from '@/types/fields'
import { asArray } from '@/lib/utils/asArray'
import { applyFiltersToQuery, type FilterConfig } from '@/lib/interface/filters'

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

function quoteSelectIdent(name: string): string {
  // PostgREST select supports quoted identifiers for columns with spaces/special chars.
  // Escape embedded quotes by doubling them.
  const safe = String(name).replace(/"/g, '""')
  return `"${safe}"`
}

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
      // Use refs to get current filters/sorts without causing dependency issues
      const currentFilters = filtersRef.current
      const currentSorts = sortsRef.current
      
      // If field metadata is provided, avoid over-fetching.
      // Only select physical columns; virtual fields (formula/lookup) are computed elsewhere.
      const safeFields = asArray<TableField>(fields)
      const physicalFieldNames = safeFields
        .filter((f) => f && typeof f === 'object' && f.name && f.type !== 'formula' && f.type !== 'lookup')
        .map((f) => f.name)

      const selectClause =
        physicalFieldNames.length > 0
          ? [quoteSelectIdent('id'), ...physicalFieldNames.map(quoteSelectIdent)].join(',')
          : '*'

      let query: any = supabase.from(tableName).select(selectClause)

      // Apply filters using shared unified filter engine (supports date operators, selects, etc.)
      const safeFilterConfigs = asArray<FilterConfig>(currentFilters as any).filter(
        (f) => !!f && typeof (f as any).field === 'string' && typeof (f as any).operator === 'string'
      )
      if (safeFilterConfigs.length > 0) {
        const normalizedFields = safeFields.map((f) => ({
          name: f.name,
          type: f.type,
          id: f.id,
          options: (f as any).options,
        }))
        query = applyFiltersToQuery(query, safeFilterConfigs, normalizedFields as any)
      }

      // Apply sorts
      currentSorts.forEach((sort) => {
        // Use quoted identifier to support columns with spaces/special characters
        query = query.order(quoteSelectIdent(sort.field), { ascending: sort.direction === 'asc' })
      })

      // Apply limit with safety cap
      query = query.limit(safeLimit)
      
      if (limit > MAX_SAFE_LIMIT) {
        console.warn(`[useGridData] Limit ${limit} exceeds safe maximum ${MAX_SAFE_LIMIT}, capping to ${MAX_SAFE_LIMIT} to prevent crashes`)
      }

      const { data, error: queryError } = await query

      if (queryError) {
        throw queryError
      }

      // CRITICAL: Normalize data to array - API might return single record, null, or object
      // Never trust API response format - always normalize
      const normalizedRows = asArray<GridRow>(data)
      setRows(normalizedRows)
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
        const { error: updateError } = await supabase
          .from(tableName)
          .update({ [fieldName]: value })
          .eq('id', rowId)

        if (updateError) {
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
