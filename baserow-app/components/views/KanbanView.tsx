"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronRight, Plus, Settings, Columns } from "lucide-react"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import type { TableRow } from "@/types/database"
import type { TableField } from "@/types/fields"
import { resolveChoiceColor, normalizeHexColor } from '@/lib/field-colors'
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { CellFactory } from "@/components/grid/CellFactory"
import { applyFiltersToQuery, deriveDefaultValuesFromFilters, type FilterConfig } from "@/lib/interface/filters"
import { isAbortError } from "@/lib/api/error-handling"
import EmptyState from "@/components/empty-states/EmptyState"
import { Button } from "@/components/ui/button"

interface KanbanViewProps {
  tableId: string
  viewId: string
  groupingFieldId: string
  fieldIds: string[]
  searchQuery?: string
  tableFields?: any[]
  filters?: FilterConfig[] // Active filters applied to this view
  colorField?: string // Field name to use for card colors (single-select field)
  imageField?: string // Field name to use for card images
  fitImageSize?: boolean // Whether to fit image to container size
  blockConfig?: Record<string, any> // Block config for modal_fields
  onRecordClick?: (recordId: string) => void
  /** Bump to force a refetch (e.g. after external record creation). */
  reloadKey?: number
  /** Callback to open block settings (for configuration) */
  onOpenSettings?: () => void
}

export default function KanbanView({ 
  tableId, 
  viewId, 
  groupingFieldId, 
  fieldIds,
  searchQuery = "",
  tableFields = [],
  filters = [],
  colorField,
  imageField,
  fitImageSize = false,
  blockConfig = {},
  onRecordClick,
  reloadKey,
  onOpenSettings,
}: KanbanViewProps) {
  // All hooks must be at the top level, before any conditional returns
  const { openRecord } = useRecordPanel()
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [supabaseTableName, setSupabaseTableName] = useState<string | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  // IMPORTANT: config may provide field IDs, but row data keys are field NAMES (supabase columns).
  const groupingFieldName = useMemo(() => {
    const raw = typeof groupingFieldId === "string" ? groupingFieldId.trim() : ""
    if (!raw) return ""
    const match = (Array.isArray(tableFields) ? tableFields : []).find(
      (f: any) => f && (f.name === raw || f.id === raw)
    )
    return (match?.name as string) || raw
  }, [groupingFieldId, tableFields])

  const colorFieldName = useMemo(() => {
    if (!colorField || typeof colorField !== "string") return null
    const raw = colorField.trim()
    if (!raw) return null
    const match = (Array.isArray(tableFields) ? tableFields : []).find(
      (f: any) => f && (f.name === raw || f.id === raw)
    )
    return (match?.name as string) || raw
  }, [colorField, tableFields])

  const imageFieldName = useMemo(() => {
    if (!imageField || typeof imageField !== "string") return null
    const raw = imageField.trim()
    if (!raw) return null
    const match = (Array.isArray(tableFields) ? tableFields : []).find(
      (f: any) => f && (f.name === raw || f.id === raw)
    )
    return (match?.name as string) || raw
  }, [imageField, tableFields])

  // Filter rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery || !tableFields.length) return rows
    
    // Convert TableRow format to flat format for search
    const flatRows = rows.map((row) => ({
      ...row.data,
      _rowId: row.id, // Preserve row ID
    }))
    
    // Filter using search helper
    const filtered = filterRowsBySearch(flatRows, tableFields, searchQuery, fieldIds)
    const filteredIds = new Set(filtered.map((r) => r._rowId))
    
    // Map back to TableRow format
    return rows.filter((row) => filteredIds.has(row.id))
  }, [rows, tableFields, searchQuery, fieldIds])

  // Helper to get color from color field
  const getCardColor = useCallback((row: TableRow): string | null => {
    if (!colorFieldName) return null
    
    const colorFieldObj = tableFields.find((f: any) => f?.name === colorFieldName || f?.id === colorFieldName)
    if (!colorFieldObj || (colorFieldObj.type !== 'single_select' && colorFieldObj.type !== 'multi_select')) {
      return null
    }
    
    const colorValue = row.data[colorFieldName]
    if (!colorValue || !(colorFieldObj.type === 'single_select' || colorFieldObj.type === 'multi_select')) return null
    
    const normalizedValue = String(colorValue).trim()
    return normalizeHexColor(
      resolveChoiceColor(
        normalizedValue,
        colorFieldObj.type,
        colorFieldObj.options,
        colorFieldObj.type === 'single_select'
      )
    )
  }, [colorFieldName, tableFields])

  // Helper to get image from image field
  const getCardImage = useCallback((row: TableRow): string | null => {
    if (!imageFieldName) return null
    
    const imageValue = row.data[imageFieldName]
    if (!imageValue) return null
    
    // Handle attachment field (array of URLs) or URL field (single URL)
    if (Array.isArray(imageValue) && imageValue.length > 0) {
      return imageValue[0]
    }
    if (typeof imageValue === 'string' && (imageValue.startsWith('http') || imageValue.startsWith('/'))) {
      return imageValue
    }
    
    return null
  }, [imageFieldName])

  useEffect(() => {
    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, reloadKey])

  async function loadRows() {
    if (!tableId) {
      console.warn("KanbanView: tableId is required")
      setRows([])
      setLoading(false)
      return
    }
    
    // Sanitize tableId - remove any trailing :X patterns (might be view ID or malformed)
    const sanitizedTableId = tableId.split(':')[0]
    
    setLoading(true)
    try {
      // First, get the table to find its supabase_table name
      const { data: table, error: tableError } = await supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", sanitizedTableId)
        .single()

      if (tableError || !table) {
        console.error("Error loading table:", tableError)
        setRows([])
        setLoading(false)
        return
      }
      setSupabaseTableName(table.supabase_table)

      // Load rows from the actual table (not table_rows)
      let query = supabase
        .from(table.supabase_table)
        .select("*")

      query = applyFiltersToQuery(query, filters, tableFields as any)

      const { data, error } = await query
        .order("created_at", { ascending: false })

      if (error) {
        if (!isAbortError(error)) {
          console.error("Error loading rows:", error)
          setRows([])
        }
      } else {
        // Convert flat rows to TableRow format for compatibility
        const tableRows = (data || []).map((row: any) => ({
          id: row.id,
          table_id: sanitizedTableId,
          data: row,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }))
        setRows(tableRows)
      }
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Error loading kanban rows:", error)
        setRows([])
      }
    }
    setLoading(false)
  }

  const showAddRecord = (blockConfig as any)?.appearance?.show_add_record === true
  const permissions = (blockConfig as any)?.permissions || {}
  const isViewOnly = permissions.mode === 'view'
  const allowInlineCreate = permissions.allowInlineCreate ?? true
  const canCreateRecord = !isViewOnly && allowInlineCreate

  const handleOpenRecord = useCallback((recordId: string) => {
    if (!supabaseTableName) return
    if (onRecordClick) {
      onRecordClick(recordId)
      return
    }
    openRecord(tableId, recordId, supabaseTableName, (blockConfig as any)?.modal_fields)
  }, [blockConfig, onRecordClick, openRecord, supabaseTableName, tableId])

  const handleCellSave = useCallback(async (rowId: string, fieldName: string, value: any) => {
    if (!supabaseTableName) return
    const { error } = await supabase
      .from(supabaseTableName)
      .update({ [fieldName]: value })
      .eq("id", rowId)
    if (error) throw error

    setRows((prev) =>
      prev.map((r) =>
        String(r.id) === String(rowId)
          ? { ...r, data: { ...(r.data || {}), [fieldName]: value } }
          : r
      )
    )
  }, [supabaseTableName])

  const handleCreateInGroup = useCallback(async (groupName: string) => {
    if (!showAddRecord || !canCreateRecord) return
    if (!supabaseTableName || !tableId) return
    try {
      const newData: Record<string, any> = {}
      const defaultsFromFilters = deriveDefaultValuesFromFilters(filters, tableFields as any)
      if (Object.keys(defaultsFromFilters).length > 0) {
        Object.assign(newData, defaultsFromFilters)
      }
      if (!groupingFieldName) {
        throw new Error("Grouping field is not configured.")
      }
      if (groupName && groupName !== "Uncategorized") {
        newData[groupingFieldName] = groupName
      } else {
        newData[groupingFieldName] = null
      }

      const { data, error } = await supabase
        .from(supabaseTableName)
        .insert([newData])
        .select()
        .single()

      if (error) throw error
      const createdId = (data as any)?.id || (data as any)?.record_id
      if (!createdId) return

      await loadRows()

      // Contract: creating a record must NOT auto-open it.
      // User can open via the dedicated chevron (or optional double-click).
      setSelectedCardId(String(createdId))
    } catch (error) {
      console.error("Error creating record:", error)
      alert("Failed to create record")
    }
  }, [showAddRecord, canCreateRecord, supabaseTableName, tableId, groupingFieldName, handleOpenRecord])

  function groupRowsByField() {
    const groups: Record<string, TableRow[]> = {}
    filteredRows.forEach((row) => {
      const groupValue = (groupingFieldName ? row.data[groupingFieldName] : null) || "Uncategorized"
      if (!groups[groupValue]) {
        groups[groupValue] = []
      }
      groups[groupValue].push(row)
    })
    return groups
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  // Empty state: no grouping field configured
  if (!groupingFieldName) {
    return (
      <EmptyState
        icon={<Columns className="h-12 w-12" />}
        title="Grouping field required"
        description="Kanban view needs a grouping field to organize cards into columns. Configure the grouping field in block settings."
        action={onOpenSettings ? {
          label: "Configure Grouping",
          onClick: onOpenSettings,
        } : undefined}
      />
    )
  }

  const groupedRows = groupRowsByField()
  const groups = Object.keys(groupedRows)

  // Empty state for search
  if (searchQuery && filteredRows.length === 0) {
    return (
      <EmptyState
        icon={<Columns className="h-12 w-12" />}
        title="No records match your search"
        description="Try adjusting your search query or clear it to see all records."
        action={{
          label: "Clear Search",
          onClick: () => {
            const params = new URLSearchParams(window.location.search)
            params.delete("q")
            window.history.replaceState({}, "", `?${params.toString()}`)
            window.location.reload()
          },
        }}
      />
    )
  }

  // Empty state: no records
  if (filteredRows.length === 0 && !searchQuery) {
    return (
      <EmptyState
        icon={<Columns className="h-12 w-12" />}
        title="No records yet"
        description="This table doesn't have any records. Create your first record to get started with the Kanban board."
      />
    )
  }

  return (
    <div className="w-full h-full overflow-x-auto bg-gray-50">
      <div className="flex gap-4 min-w-max p-6">
        {groups.map((groupName) => (
          <div key={groupName} className="flex-shrink-0 w-80">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3">
              <h3 className="text-sm font-semibold text-gray-900">{groupName}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{groupedRows[groupName].length} items</p>
            </div>
            <div className="space-y-2">
              {groupedRows[groupName].map((row) => {
                const cardColor = getCardColor(row)
                const cardImage = getCardImage(row)
                const borderColor = cardColor ? { borderLeftColor: cardColor, borderLeftWidth: '4px' } : {}
                
                return (
                <Card 
                  key={row.id} 
                  className={`hover:shadow-md transition-shadow bg-white border-gray-200 rounded-lg cursor-default ${
                    selectedCardId === String(row.id) ? "ring-1 ring-blue-400/40 bg-blue-50/30" : ""
                  }`}
                  style={borderColor}
                  onClick={() => setSelectedCardId(String(row.id))}
                  onDoubleClick={() => handleOpenRecord(String(row.id))}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      {/* Row open control */}
                      <div className="flex items-start justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenRecord(String(row.id))
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50/60 transition-colors"
                          title="Open record"
                          aria-label="Open record"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Image if configured */}
                      {cardImage && (
                        <div className={`w-full ${fitImageSize ? 'h-auto' : 'h-32'} rounded overflow-hidden bg-gray-100 mb-2`}>
                          <img
                            src={cardImage}
                            alt=""
                            className={`w-full ${fitImageSize ? 'h-auto object-contain' : 'h-32 object-cover'}`}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        </div>
                      )}
                      {(Array.isArray(fieldIds) ? fieldIds : [])
                        .filter((fid) => fid !== groupingFieldId)
                        .slice(0, 3)
                        .map((fieldId) => {
                          const fieldObj = (Array.isArray(tableFields) ? tableFields : []).find(
                            (f: any) => f?.name === fieldId || f?.id === fieldId
                          ) as TableField | undefined
                          if (!fieldObj) return null
                          const fieldName = fieldObj.name
                          const isVirtual = fieldObj.type === "formula" || fieldObj.type === "lookup"
                          return (
                            <div
                              key={fieldId}
                              className="text-sm"
                              onClick={(e) => e.stopPropagation()}
                              onDoubleClick={(e) => e.stopPropagation()}
                            >
                              <div className="text-gray-500 font-medium text-xs uppercase tracking-wide">
                                {fieldObj.name}:
                              </div>
                              <div className="text-gray-900">
                                <CellFactory
                                  field={fieldObj}
                                  value={(row.data || {})[fieldName]}
                                  rowId={String(row.id)}
                                  tableName={supabaseTableName || ""}
                                  editable={!fieldObj.options?.read_only && !isVirtual && !!supabaseTableName}
                                  wrapText={true}
                                  rowHeight={32}
                                  onSave={(value) => handleCellSave(String(row.id), fieldName, value)}
                                />
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </CardContent>
                </Card>
                )
              })}
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                onClick={() => handleCreateInGroup(groupName)}
                disabled={!showAddRecord || !canCreateRecord || !supabaseTableName}
                title={
                  !showAddRecord
                    ? 'Enable "Show Add record button" in block settings to add records'
                    : !canCreateRecord
                      ? 'Adding records is disabled for this block'
                      : 'Add a new record to this column'
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Card
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

