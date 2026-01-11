"use client"

import { useState, useEffect, useMemo } from "react"
import React from "react"
import { supabase } from "@/lib/supabase/client"
import { Plus, ChevronDown, ChevronRight } from "lucide-react"
import Cell from "./Cell"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import type { TableField } from "@/types/fields"
import { computeFormulaFields } from "@/lib/formulas/computeFormulaFields"
import { applyFiltersToQuery, type FilterConfig } from "@/lib/interface/filters"
import { asArray } from "@/lib/utils/asArray"
import { sortRowsByFieldType, shouldUseClientSideSorting } from "@/lib/sorting/fieldTypeAwareSort"

interface BlockPermissions {
  mode?: 'view' | 'edit'
  allowInlineCreate?: boolean
  allowInlineDelete?: boolean
  allowOpenRecord?: boolean
}

interface GridViewProps {
  tableId: string
  viewId: string
  supabaseTableName: string
  viewFields: Array<{
    field_name: string
    visible: boolean
    position: number
  }>
  viewFilters?: Array<{
    field_name: string
    operator: string
    value?: string
  }>
  filters?: FilterConfig[] // Standardized FilterConfig format (takes precedence over viewFilters)
  viewSorts?: Array<{
    field_name: string
    direction: string
  }>
  searchTerm?: string
  groupBy?: string
  tableFields?: TableField[]
  onAddField?: () => void
  onEditField?: (fieldName: string) => void
  isEditing?: boolean // When false, hide builder controls (add row, add field)
  onRecordClick?: (recordId: string) => void // Emit recordId on row click
  rowHeight?: string // Row height: 'compact', 'medium', 'comfortable'
  permissions?: BlockPermissions // Block-level permissions
}

const ITEMS_PER_PAGE = 100

export default function GridView({
  tableId,
  viewId,
  supabaseTableName,
  viewFields,
  viewFilters = [],
  filters = [], // Standardized filters (preferred)
  viewSorts = [],
  searchTerm = "",
  groupBy,
  tableFields = [],
  onAddField,
  onEditField,
  isEditing = false,
  onRecordClick,
  rowHeight = 'medium',
  permissions,
}: GridViewProps) {
  const { openRecord } = useRecordPanel()
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [tableError, setTableError] = useState<string | null>(null)
  const [initializingFields, setInitializingFields] = useState(false)

  // CRITICAL: Normalize all inputs at grid entry point
  // Never trust upstream to pass correct types - always normalize
  type ViewFieldType = {
    field_name: string
    visible: boolean
    position: number
  }
  const safeViewFields = asArray<ViewFieldType>(viewFields)
  const safeTableFields = asArray<TableField>(tableFields)
  type ViewFilterType = {
    field_name: string
    operator: string
    value?: string
  }
  const safeViewFilters = asArray<ViewFilterType>(viewFilters)
  const safeFilters = asArray<FilterConfig>(filters)
  type ViewSortType = {
    field_name: string
    direction: string
  }
  const safeViewSorts = asArray<ViewSortType>(viewSorts)

  // Defensive logging (temporary - remove after fixing all upstream issues)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('GridView input types', {
      rows: Array.isArray(rows),
      viewFields: Array.isArray(viewFields),
      tableFields: Array.isArray(tableFields),
      viewFilters: Array.isArray(viewFilters),
      filters: Array.isArray(filters),
      viewSorts: Array.isArray(viewSorts),
    })
  }

  // Get visible fields ordered by order_index (from table_fields) or position
  const visibleFields = safeViewFields
    .filter((f) => f && f.visible)
    .map((vf) => {
      const tableField = safeTableFields.find((tf) => tf.name === vf.field_name)
      return {
        ...vf,
        order_index: tableField?.order_index ?? tableField?.position ?? vf.position,
      }
    })
    .sort((a, b) => a.order_index - b.order_index)

  useEffect(() => {
    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseTableName, filters, viewFilters, viewSorts, tableFields])

  async function loadRows() {
    if (!supabaseTableName) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      let query = supabase.from(supabaseTableName).select("*")

      // Use standardized filters if provided, otherwise fall back to viewFilters format
      if (safeFilters.length > 0) {
        // Convert tableFields to format expected by applyFiltersToQuery
        const normalizedFields = safeTableFields.map(f => ({ name: f.name, type: f.type }))
        query = applyFiltersToQuery(query, safeFilters, normalizedFields)
      } else if (safeViewFilters.length > 0) {
        // Legacy: Convert viewFilters format to FilterConfig format
        const legacyFilters: FilterConfig[] = safeViewFilters.map(f => ({
          field: f.field_name,
          operator: f.operator as FilterConfig['operator'],
          value: f.value,
        }))
        const normalizedFields = safeTableFields.map(f => ({ name: f.name, type: f.type }))
        query = applyFiltersToQuery(query, legacyFilters, normalizedFields)
      }

      // Check if we need client-side sorting (for single_select by order, multi_select by first value)
      const needsClientSideSort = safeViewSorts.length > 0 && shouldUseClientSideSorting(
        safeViewSorts.map(s => ({ field_name: s.field_name, direction: s.direction as 'asc' | 'desc' })),
        safeTableFields
      )

      // Apply sorting at query level (for fields that don't need client-side sorting)
      if (safeViewSorts.length > 0 && !needsClientSideSort) {
        // Apply multiple sorts if needed
        for (let i = 0; i < safeViewSorts.length; i++) {
          const sort = safeViewSorts[i]
          if (i === 0) {
            query = query.order(sort.field_name, {
              ascending: sort.direction === "asc",
            })
          } else {
            // For additional sorts, we'd need to chain them
            // Supabase supports multiple order() calls
            query = query.order(sort.field_name, {
              ascending: sort.direction === "asc",
            })
          }
        }
      } else if (safeViewSorts.length === 0) {
        // Default sort by id descending
        query = query.order("id", { ascending: false })
      }
      // If needsClientSideSort is true, we'll sort after fetching (don't apply DB sorting)

      // For client-side sorting, we need to fetch more rows to sort properly
      // Otherwise, limit results for performance
      if (!needsClientSideSort) {
        query = query.limit(ITEMS_PER_PAGE)
      } else {
        // Fetch more rows for client-side sorting (will limit after sorting)
        query = query.limit(ITEMS_PER_PAGE * 2)
      }

      const { data, error } = await query

      if (error) {
        console.error("Error loading rows:", error)
        // Check if table doesn't exist - check multiple error patterns
        const errorMessage = error.message || ''
        const isTableNotFound = 
          error.code === "42P01" || 
          error.code === "PGRST116" ||
          errorMessage.includes("does not exist") || 
          errorMessage.includes("relation") ||
          errorMessage.includes("schema cache") ||
          errorMessage.includes("Could not find the table")
        
        if (isTableNotFound) {
          setTableError(`The table "${supabaseTableName}" does not exist. Attempting to create it...`)
          
          // Try to create the table automatically
          try {
            const createResponse = await fetch('/api/tables/create-table', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tableName: supabaseTableName })
            })
            
            const createResult = await createResponse.json()
            
            if (createResult.success) {
              // Table created, reload rows after a short delay to allow schema cache to update
              setTimeout(() => {
                setTableError(null)
                loadRows()
              }, 1000)
              return
            } else {
              // Show the SQL needed to create the table
              const errorMsg = createResult.message || createResult.error || `Table "${supabaseTableName}" does not exist.`
              const sqlMsg = createResult.sql ? `\n\nRun this SQL in Supabase:\n${createResult.sql}` : ''
              setTableError(errorMsg + sqlMsg)
            }
          } catch (createError) {
            console.error('Failed to create table:', createError)
            setTableError(`The table "${supabaseTableName}" does not exist and could not be created automatically. Please create it manually in Supabase.`)
          }
        } else {
          setTableError(`Error loading data: ${error.message}`)
        }
        setRows([])
      } else {
        // CRITICAL: Normalize data to array - API might return single record or null
        let dataArray = asArray(data)
        
        // Compute formula fields for each row
        const formulaFields = safeTableFields.filter(f => f.type === 'formula')
        let computedRows = dataArray.map(row => 
          computeFormulaFields(row, formulaFields, safeTableFields)
        )
        
        // Apply client-side sorting if needed (for single_select by order, multi_select by first value)
        if (needsClientSideSort && safeViewSorts.length > 0) {
          computedRows = sortRowsByFieldType(
            computedRows,
            safeViewSorts.map(s => ({ field_name: s.field_name, direction: s.direction as 'asc' | 'desc' })),
            safeTableFields
          )
          // Limit after sorting
          computedRows = computedRows.slice(0, ITEMS_PER_PAGE)
        }
        
        setTableError(null)
        setRows(computedRows)
      }
    } catch (error) {
      console.error("Error loading rows:", error)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  async function handleCellSave(rowId: string, fieldName: string, value: any) {
    // Don't allow saving if view-only
    if (isViewOnly) return
    if (!rowId || !supabaseTableName) return

    try {
      const { error } = await supabase
        .from(supabaseTableName)
        .update({ [fieldName]: value })
        .eq("id", rowId)

      if (error) {
        console.error("Error saving cell:", error)
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          setTableError(`The table "${supabaseTableName}" does not exist in Supabase.`)
        }
        throw error
      }

      // Update local state immediately for better UX
      setRows((prevRows) =>
        prevRows.map((row) =>
          row.id === rowId ? { ...row, [fieldName]: value } : row
        )
      )
    } catch (error) {
      throw error
    }
  }

  async function handleAddRow() {
    if (!supabaseTableName) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const newRow: Record<string, any> = {}

      // Initialize visible fields with empty values
      visibleFields.forEach((field) => {
        newRow[field.field_name] = null
      })

      const { data, error } = await supabase
        .from(supabaseTableName)
        .insert([newRow])
        .select()
        .single()

      if (error) {
        console.error("Error adding row:", error)
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          setTableError(`The table "${supabaseTableName}" does not exist in Supabase.`)
        }
      } else {
        await loadRows()
        // Open the new record in the global panel
        if (data && data.id) {
          openRecord(tableId, data.id, supabaseTableName)
        }
      }
    } catch (error: any) {
      console.error("Error adding row:", error)
      if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
        setTableError(`The table "${supabaseTableName}" does not exist in Supabase.`)
      }
    }
  }

  // Determine permissions
  const isViewOnly = permissions?.mode === 'view'
  const allowInlineCreate = permissions?.allowInlineCreate ?? true
  const allowInlineDelete = permissions?.allowInlineDelete ?? true
  const allowOpenRecord = permissions?.allowOpenRecord ?? true
  const canEdit = !isViewOnly && isEditing

  function handleRowClick(rowId: string) {
    // Don't open record if not allowed
    if (!allowOpenRecord) return

    // If onRecordClick callback provided, use it (for blocks)
    if (onRecordClick) {
      onRecordClick(rowId)
    } else {
      // Otherwise, use RecordPanel context (for views)
      openRecord(tableId, rowId, supabaseTableName)
    }
  }

  // Apply client-side search
  // CRITICAL: Normalize rows to array before filtering
  const safeRows = asArray<Record<string, any>>(rows)
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return safeRows

    const searchLower = searchTerm.toLowerCase()
    return safeRows.filter((row) => {
      return visibleFields.some((field) => {
        const value = row[field.field_name]
        if (value === null || value === undefined) return false
        return String(value).toLowerCase().includes(searchLower)
      })
    })
  }, [safeRows, searchTerm, visibleFields])

  // Group rows if groupBy is set
  // CRITICAL: Normalize filteredRows before grouping
  const groupedRows = useMemo(() => {
    if (!groupBy) return null

    const groups: Record<string, Record<string, any>[]> = {}

    // filteredRows is already normalized, but guard for safety
    filteredRows.forEach((row) => {
      if (!row) return // Skip null/undefined rows
      const groupValue = row[groupBy] ?? "Uncategorized"
      const groupKey = String(groupValue)
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(row)
    })

    // Sort group keys
    const sortedGroupKeys = Object.keys(groups).sort()

    return sortedGroupKeys.map((key) => ({
      key,
      value: groups[key][0]?.[groupBy],
      rows: asArray(groups[key]), // Ensure rows is always an array
    }))
  }, [filteredRows, groupBy])

  function toggleGroup(groupKey: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!supabaseTableName) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Table not configured</div>
      </div>
    )
  }

  if (tableError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="max-w-md p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Table Not Found</h3>
          <p className="text-sm text-yellow-700 mb-4">{tableError}</p>
          <p className="text-xs text-yellow-600">
            The table <code className="bg-yellow-100 px-1 py-0.5 rounded">{supabaseTableName}</code> needs to be created in your Supabase database.
            You can create it manually in the Supabase dashboard or use a migration.
          </p>
        </div>
      </div>
    )
  }

  // Function to initialize view fields
  async function handleInitializeFields() {
    if (!viewId || initializingFields) return // Prevent duplicate calls
    
    setInitializingFields(true)
    try {
      const response = await fetch(`/api/views/${viewId}/initialize-fields`, {
        method: 'POST',
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        // Don't show error for expected cases (table not found, already configured, etc.)
        const isExpectedError = data.error_code === 'TABLE_NOT_FOUND' || 
                                data.error_code === 'NO_FIELDS' ||
                                data.message?.includes('already') ||
                                data.message?.includes('already configured')
        
        if (isExpectedError) {
          // These are expected - just log and return
          console.log('Fields initialization skipped (expected):', data.message || data.error)
          return
        }
        
        // Show detailed error message for unexpected errors
        const errorMessage = data.details 
          ? `${data.error || 'Failed to initialize fields'}: ${data.details}`
          : data.error || 'Failed to initialize fields'
        
        // Log full error details for debugging
        console.error('Error initializing fields:', {
          status: response.status,
          error: data.error,
          error_code: data.error_code,
          details: data.details,
          viewId,
          fullResponse: data,
        })
        
        throw new Error(errorMessage)
      }
      
      // Show success message if partial success or warning
      if (data.warning) {
        console.log('Fields initialization warning:', data.warning)
      }
      
      // Only reload if fields were actually added
      if (data.added > 0) {
        // Reload the page to refresh viewFields
        window.location.reload()
      } else if (data.message) {
        // Just log if no fields were added (already configured)
        console.log('Fields initialization:', data.message)
      }
    } catch (error: any) {
      console.error('Error initializing fields:', error)
      // Only show alert for unexpected errors
      const errorMessage = error.message || 'Failed to initialize fields. Please try again.'
      alert(`Error: ${errorMessage}\n\nIf this problem persists, please check:\n1. You have permission to modify this view\n2. The view is properly connected to a table\n3. The table has fields configured`)
    } finally {
      setInitializingFields(false)
    }
  }

  // Show message when no visible fields are configured
  if (visibleFields.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="max-w-md p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No columns configured</h3>
          <p className="text-sm text-gray-600 mb-4">
            This view has no visible fields configured. Add fields to the view to display data.
          </p>
          <div className="flex flex-col gap-2 items-center">
            {safeTableFields.length > 0 && (
              <button
                onClick={handleInitializeFields}
                disabled={initializingFields}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors inline-flex items-center gap-2"
              >
                {initializingFields ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Adding fields...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add All Fields ({safeTableFields.length})
                  </>
                )}
              </button>
            )}
            {isEditing && onAddField && (
              <button
                onClick={onAddField}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create New Field
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full relative">
      {/* Toolbar - Only show builder controls in edit mode */}
      {isEditing && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Only show Add Row button if inline create is allowed */}
            {allowInlineCreate && (
              <button
                onClick={handleAddRow}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Row
              </button>
            )}
            {onAddField && (
              <button
                onClick={onAddField}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Field
              </button>
            )}
          </div>
          <div className="text-sm text-gray-500">
            {filteredRows.length} {filteredRows.length === 1 ? "row" : "rows"}
            {searchTerm && filteredRows.length !== safeRows.length && (
              <span className="ml-1">(filtered from {safeRows.length})</span>
            )}
          </div>
        </div>
      )}

      {/* Grid Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto pb-3">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {visibleFields.map((field) => {
                  const tableField = safeTableFields.find(f => f.name === field.field_name)
                  const isVirtual = tableField?.type === 'formula' || tableField?.type === 'lookup'
                  return (
                    <th
                      key={field.field_name}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px] sticky top-0 bg-gray-50 z-10 group hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          onClick={() => onEditField?.(field.field_name)}
                          className={`flex-1 ${onEditField ? 'cursor-pointer hover:text-blue-600' : ''}`}
                          title={tableField?.type === 'formula' && tableField?.options?.formula 
                            ? `Formula: ${tableField.options.formula}` 
                            : undefined}
                        >
                          {field.field_name}
                          {isVirtual && (
                            <span className="ml-1 text-xs text-gray-400" title="Formula field">(fx)</span>
                          )}
                        </span>
                        {tableField?.required && (
                          <span className="text-red-500 text-xs ml-1">*</span>
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleFields.length}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    {searchTerm ? "No rows match your search" : "No rows found"}
                  </td>
                </tr>
              ) : groupBy && groupedRows && Array.isArray(groupedRows) ? (
                // Render grouped rows
                // CRITICAL: groupedRows is already verified as array, but use type annotation for safety
                (groupedRows as Array<{ key: string; value: any; rows: Record<string, any>[] }>).map((group) => {
                  const isCollapsed = collapsedGroups.has(group.key)
                  const groupRows = asArray<Record<string, any>>(group.rows)
                  return (
                    <React.Fragment key={group.key}>
                      {/* Group header */}
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <td
                          colSpan={visibleFields.length}
                          className="px-4 py-2"
                        >
                          <button
                            onClick={() => toggleGroup(group.key)}
                            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 w-full text-left"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <span className="font-semibold">
                              {groupBy}: {String(group.value ?? "Uncategorized")}
                            </span>
                            <span className="text-gray-500 ml-2">
                              ({groupRows.length} {groupRows.length === 1 ? "row" : "rows"})
                            </span>
                          </button>
                        </td>
                      </tr>
                      {/* Group rows */}
                      {!isCollapsed &&
                        groupRows.map((row) => {
                          const rowHeightClass = rowHeight === 'compact' ? 'py-1' : rowHeight === 'comfortable' ? 'py-4' : 'py-2'
                          return (
                          <tr
                            key={row.id}
                            className={`border-b border-gray-100 ${allowOpenRecord ? 'hover:bg-blue-50 transition-colors cursor-pointer' : 'cursor-default'} ${rowHeightClass}`}
                            onClick={() => handleRowClick(row.id)}
                          >
                            {visibleFields.map((field) => (
                              <td
                                key={field.field_name}
                                className="px-0 py-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Cell
                                  value={row[field.field_name]}
                                  fieldName={field.field_name}
                                  editable={canEdit}
                                  onSave={async (value) => {
                                    await handleCellSave(row.id, field.field_name, value)
                                  }}
                                />
                              </td>
                            ))}
                          </tr>
                          )
                        })}
                    </React.Fragment>
                  )
                })
              ) : (
                // Render ungrouped rows
                // CRITICAL: filteredRows is already normalized, but guard for safety
                filteredRows.map((row) => {
                  const rowHeightClass = rowHeight === 'compact' ? 'py-1' : rowHeight === 'comfortable' ? 'py-4' : 'py-2'
                  return (
                  <tr
                    key={row.id}
                    className={`border-b border-gray-100 ${allowOpenRecord ? 'hover:bg-blue-50 transition-colors cursor-pointer' : 'cursor-default'} ${rowHeightClass}`}
                    onClick={() => handleRowClick(row.id)}
                  >
                    {visibleFields.map((field) => {
                      const tableField = safeTableFields.find(f => f.name === field.field_name)
                      const isVirtual = tableField?.type === 'formula' || tableField?.type === 'lookup'
                      return (
                        <td
                          key={field.field_name}
                          className="px-0 py-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Cell
                            value={row[field.field_name]}
                            fieldName={field.field_name}
                            fieldType={tableField?.type}
                            fieldOptions={tableField?.options}
                            isVirtual={isVirtual}
                            editable={canEdit && !isVirtual}
                            onSave={async (value) => {
                              if (!isVirtual) {
                                await handleCellSave(row.id, field.field_name, value)
                              }
                            }}
                          />
                        </td>
                      )
                    })}
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record panel is now global - no local drawer needed */}
    </div>
  )
}
