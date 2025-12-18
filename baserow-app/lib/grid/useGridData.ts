import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { TableField } from '@/types/fields'

export interface GridRow {
  id: string
  [key: string]: any
}

export interface UseGridDataOptions {
  tableName: string
  fields?: TableField[]
  filters?: any[]
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

export function useGridData({
  tableName,
  fields = [],
  filters = [],
  sorts = [],
  limit = 10000,
}: UseGridDataOptions): UseGridDataReturn {
  const [rows, setRows] = useState<GridRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const filtersString = JSON.stringify(filters)
  const sortsString = JSON.stringify(sorts)

  const loadData = useCallback(async () => {
    if (!tableName) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      let query: any = supabase.from(tableName).select('*')

      // Apply filters
      filters.forEach((filter) => {
        const { field, operator, value } = filter
        switch (operator) {
          case 'eq':
            query = query.eq(field, value)
            break
          case 'neq':
            query = query.neq(field, value)
            break
          case 'gt':
            query = query.gt(field, value)
            break
          case 'gte':
            query = query.gte(field, value)
            break
          case 'lt':
            query = query.lt(field, value)
            break
          case 'lte':
            query = query.lte(field, value)
            break
          case 'like':
            query = query.like(field, `%${value}%`)
            break
          case 'ilike':
            query = query.ilike(field, `%${value}%`)
            break
          case 'is':
            if (value === null) {
              query = query.is(field, null)
            }
            break
        }
      })

      // Apply sorts
      sorts.forEach((sort) => {
        query = query.order(sort.field, { ascending: sort.direction === 'asc' })
      })

      // Apply limit
      if (limit) {
        query = query.limit(limit)
      }

      const { data, error: queryError } = await query

      if (queryError) {
        throw queryError
      }

      setRows(data || [])
    } catch (err: any) {
      console.error('Error loading grid data:', err)
      setError(err.message || 'Failed to load data')
      setRows([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName, filtersString, sortsString, limit])

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

  return {
    rows,
    loading,
    error,
    refresh: loadData,
    updateCell,
    insertRow,
    deleteRow,
  }
}
