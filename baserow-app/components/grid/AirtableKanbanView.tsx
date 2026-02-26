"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Plus,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  GripVertical,
} from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import ColumnManagementDialog from "./ColumnManagementDialog"
import RecordDrawer from "./RecordDrawer"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import { formatErrorForLog } from "@/lib/api/error-handling"
import type { TableField } from "@/types/fields"
import { sortRowsByFieldType, shouldUseClientSideSorting } from "@/lib/sorting/fieldTypeAwareSort"
import { resolveChoiceColor, normalizeHexColor, getTextColorForBackground } from "@/lib/field-colors"
import { CellFactory } from "./CellFactory"
import { buildSelectClause, toPostgrestColumn } from "@/lib/supabase/postgrest"
import { normalizeSelectOptionsForUi } from "@/lib/fields/select-options"
import { getFieldDisplayName } from "@/lib/fields/display"
import { isAbortError, formatErrorForLog } from "@/lib/api/error-handling"
import { deriveDefaultValuesFromFilters, type FilterConfig } from "@/lib/interface/filters"

// PostgREST expects unquoted identifiers in select/order clauses; see `lib/supabase/postgrest`.

interface AirtableKanbanViewProps {
  tableId: string
  viewId: string
  supabaseTableName: string
  tableFields: TableField[]
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
  viewSorts?: Array<{
    field_name: string
    direction: string
  }>
  kanbanGroupField?: string
  cardFields?: string[]
  showFieldLabels?: boolean
  userRole?: "admin" | "editor" | "viewer" | null
}

interface KanbanColumn {
  id: string
  name: string
  color?: string
  collapsed: boolean
}

export default function AirtableKanbanView({
  tableId,
  viewId,
  supabaseTableName,
  tableFields,
  viewFields,
  viewFilters = [],
  viewSorts = [],
  kanbanGroupField,
  cardFields = [],
  showFieldLabels = false,
  userRole = "editor",
}: AirtableKanbanViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchQuery = searchParams.get("q") || ""
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(true)
  const [groupField, setGroupField] = useState<TableField | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [openRow, setOpenRow] = useState<Record<string, any> | null>(null)
  const [columnManagementOpen, setColumnManagementOpen] = useState(false)
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set())

  const canEdit = userRole === "admin" || userRole === "editor"
  const canManageColumns = userRole === "admin"

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Find groupable field - require explicit selection, no auto-detection
  useEffect(() => {
    if (kanbanGroupField) {
      const field = tableFields.find((f) => f.name === kanbanGroupField)
      if (field && (field.type === "single_select" || field.type === "multi_select")) {
        setGroupField(field)
      } else {
        setGroupField(null)
      }
    } else {
      setGroupField(null)
    }
  }, [kanbanGroupField, tableFields])

  const loadRows = useCallback(async () => {
    if (!supabaseTableName || !groupField) return

    setLoading(true)
    try {
      let query = supabase.from(supabaseTableName).select("*")

      // Apply filters
      for (const filter of viewFilters) {
        const fieldValue = filter.value
        switch (filter.operator) {
          case "equal":
            query = query.eq(filter.field_name, fieldValue)
            break
          case "not_equal":
            query = query.neq(filter.field_name, fieldValue)
            break
          case "contains":
            query = query.ilike(filter.field_name, `%${fieldValue}%`)
            break
          case "is_empty":
            query = query.or(`${filter.field_name}.is.null,${filter.field_name}.eq.`)
            break
          case "is_not_empty":
            query = query.not(filter.field_name, "is", null)
            break
        }
      }

      // Check if we need client-side sorting (for single_select by order, multi_select by first value)
      const needsClientSideSort = viewSorts.length > 0 && shouldUseClientSideSorting(
        viewSorts.map(s => ({ field_name: s.field_name, direction: s.direction as 'asc' | 'desc' })),
        tableFields
      )

      // Apply sorting at query level (for fields that don't need client-side sorting)
      if (viewSorts.length > 0 && !needsClientSideSort) {
        for (const sort of viewSorts) {
          const col = toPostgrestColumn(sort.field_name)
          if (!col) {
            console.warn('[AirtableKanbanView] Skipping sort on invalid column:', sort.field_name)
            continue
          }
          query = query.order(col, {
            ascending: sort.direction === "asc",
          })
        }
      } else if (viewSorts.length === 0) {
        query = query.order("id", { ascending: false })
      }

      const { data, error } = await query

      if (error) {
        if (isAbortError(error)) return
        console.error("Error loading rows:", formatErrorForLog(error))
        setRows([])
      } else {
        let rowsData = data || []
        
        // Apply client-side sorting if needed (for linked/lookup fields, selects, etc.)
        if (needsClientSideSort && viewSorts.length > 0) {
          try {
            const sortConfig = viewSorts.map(s => ({ 
              field_name: s.field_name, 
              direction: s.direction as 'asc' | 'desc' 
            }))
            rowsData = await sortRowsByFieldType(rowsData, sortConfig, tableFields)
          } catch (sortError) {
            console.error('[AirtableKanbanView] Error applying client-side sort:', sortError)
            // Continue with unsorted data rather than failing completely
          }
        } else if (viewSorts.length > 0 && !needsClientSideSort) {
          // Database sorting was already applied in the query above
          // No additional action needed
        }
        
        setRows(rowsData)
      }
    } catch (error) {
      if (isAbortError(error)) return
      console.error("Error loading rows:", error)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [supabaseTableName, groupField, viewFilters, viewSorts, tableFields])

  // Load rows
  useEffect(() => {
    if (supabaseTableName && groupField) {
      loadRows()
    }
  }, [supabaseTableName, groupField, loadRows])

  // Filter rows by search query
  const visibleFieldNames = useMemo(() => {
    const fieldsArray = Array.isArray(viewFields) ? viewFields : []
    return fieldsArray.filter((f) => f.visible).map((f) => f.field_name)
  }, [viewFields])

  const filteredRows = useMemo(() => {
    if (!searchQuery) return rows
    return filterRowsBySearch(rows, tableFields, searchQuery, visibleFieldNames)
  }, [rows, tableFields, searchQuery, visibleFieldNames])

  // Group rows by column (keyed by raw value: option id or label as stored in DB)
  // Note: Rows are already sorted before grouping, so order should be preserved within each group
  const groupedRows = useMemo(() => {
    if (!groupField) return {}
    const groups: Record<string, typeof filteredRows> = {}
    filteredRows.forEach((row) => {
      const value = row[groupField.name]
      const key =
        value == null || value === ""
          ? "—"
          : Array.isArray(value)
            ? (value[0] ?? "—")
            : String(value).trim() || "—"
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(row)
    })
    // Rows are already sorted globally, so order is preserved within each group
    return groups
  }, [filteredRows, groupField])

  // Derive columns from select options so header shows label, not id (DB may store option id)
  const columns = useMemo((): KanbanColumn[] => {
    if (!groupField || (groupField.type !== "single_select" && groupField.type !== "multi_select")) return []
    const { selectOptions } = normalizeSelectOptionsForUi(groupField.type, groupField.options)
    const idToLabel = new Map<string, string>()
    for (const o of selectOptions) {
      idToLabel.set(o.id, o.label)
      if (o.id !== o.label) idToLabel.set(o.label, o.label)
    }
    idToLabel.set("—", "—")

    const uniqueInData = new Set<string>()
    filteredRows.forEach((row) => {
      const v = row[groupField.name]
      const key = v == null || v === "" ? "—" : Array.isArray(v) ? (v[0] ?? "—") : String(v).trim() || "—"
      uniqueInData.add(key)
    })

    const ordered = [...selectOptions].sort((a, b) => a.sort_index - b.sort_index)
    const seen = new Set<string>()
    const result: KanbanColumn[] = []

    for (const o of ordered) {
      if (!seen.has(o.id)) {
        seen.add(o.id)
        result.push({ id: o.id, name: idToLabel.get(o.id) ?? o.id, collapsed: collapsedColumns.has(o.id) })
      }
      if (o.id !== o.label && !seen.has(o.label)) {
        seen.add(o.label)
        result.push({ id: o.label, name: o.label, collapsed: collapsedColumns.has(o.label) })
      }
    }
    if (!seen.has("—")) {
      result.push({ id: "—", name: "—", collapsed: collapsedColumns.has("—") })
    }
    for (const key of uniqueInData) {
      if (!seen.has(key)) {
        seen.add(key)
        result.push({ id: key, name: idToLabel.get(key) ?? key, collapsed: collapsedColumns.has(key) })
      }
    }
    return result
  }, [groupField, filteredRows, collapsedColumns])

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || !groupField) {
      setActiveId(null)
      return
    }

    const rowId = active.id as string
    const overId = over.id as string

    // Find the row
    const row = rows.find((r) => r.id === rowId)
    if (!row) {
      setActiveId(null)
      return
    }

    // Find target column
    let targetColumn: string | null = null
    
    // Check if dropped on a column droppable
    if (overId.startsWith("column-")) {
      targetColumn = overId.replace("column-", "")
    } else {
      // Check if dropped on another card - find which column that card belongs to
      const targetRow = rows.find((r) => r.id === overId)
      if (targetRow) {
        targetColumn = targetRow[groupField.name] || null
      } else {
        // Check data from droppable
        const dropData = (over.data.current as any)
        if (dropData?.columnId) {
          targetColumn = dropData.columnId
        }
      }
    }

    if (!targetColumn) {
      setActiveId(null)
      return
    }

    const currentValue = row[groupField.name]

    // If dropped on same column, it's a reorder (no-op for now)
    if (currentValue === targetColumn) {
      setActiveId(null)
      return
    }

    // Update the row's group field
    try {
      const updateValue = groupField.type === "multi_select" 
        ? [targetColumn] 
        : targetColumn

      await supabase
        .from(supabaseTableName)
        .update({ [groupField.name]: updateValue })
        .eq("id", rowId)

      await loadRows()
    } catch (error) {
      console.error("Error updating row:", error)
      alert("Failed to move card")
    }

    setActiveId(null)
  }

  async function handleAddCard(columnId: string) {
    if (!groupField) return

    try {
      const newValue = groupField.type === "multi_select" ? [columnId] : columnId
      const filtersAsConfig: FilterConfig[] = viewFilters.map((f) => ({
        field: f.field_name,
        operator: f.operator as FilterConfig["operator"],
        value: f.value,
      }))
      const filterDefaults = deriveDefaultValuesFromFilters(filtersAsConfig, tableFields)
      const insertData = {
        [groupField.name]: newValue,
        ...filterDefaults,
      }
      const { error } = await supabase
        .from(supabaseTableName)
        .insert([insertData])
        .select()
        .single()

      if (error) {
        console.error("Error creating card:", error)
        alert("Failed to create card")
      } else {
        await loadRows()
      }
    } catch (error) {
      console.error("Error creating card:", error)
      alert("Failed to create card")
    }
  }

  function toggleColumn(columnId: string) {
    setCollapsedColumns((prev) => {
      const next = new Set(prev)
      if (next.has(columnId)) {
        next.delete(columnId)
      } else {
        next.add(columnId)
      }
      return next
    })
  }

  // Get card fields to display (match by name, id, or display name; dedupe by id to avoid duplicate title/labels)
  const displayCardFields = useMemo(() => {
    const safeCardFields = Array.isArray(cardFields) ? cardFields : []
    const safeTableFields = Array.isArray(tableFields) ? tableFields : []

    let fields: TableField[]
    if (safeCardFields.length > 0) {
      fields = safeCardFields
        .map((key) =>
          safeTableFields.find(
            (f) =>
              f &&
              (f.name === key ||
                f.id === key ||
                getFieldDisplayName(f) === key)
          )
        )
        .filter((f): f is TableField => f !== undefined && f !== null)
    } else {
      fields = safeTableFields
        .filter((f) => f && f.name !== groupField?.name)
        .slice(0, 3)
    }
    // Dedupe by field id so the same field never appears twice (avoids duplicate title on card)
    const seen = new Set<string>()
    return fields.filter((f) => {
      const key = f.id ?? f.name
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [cardFields, tableFields, groupField])

  const handleCellSave = useCallback(
    async (rowId: string, fieldName: string, value: any) => {
      if (!supabaseTableName) return
      try {
        const { error } = await supabase
          .from(supabaseTableName)
          .update({ [fieldName]: value })
          .eq("id", rowId)
        if (error) throw error
        setRows((prev) => prev.map((r) => (String(r.id) === String(rowId) ? { ...r, [fieldName]: value } : r)))
      } catch (error) {
        console.error("Error saving card field:", error)
        alert("Failed to save. Please try again.")
      }
    },
    [supabaseTableName]
  )

  const handleOpenRow = useCallback((row: Record<string, any>) => {
    setOpenRow(row)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  // Empty state for search
  if (searchQuery && filteredRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <div className="text-sm mb-2">No records match your search</div>
        <button
          onClick={() => {
            const params = new URLSearchParams(window.location.search)
            params.delete("q")
            window.history.replaceState({}, "", `?${params.toString()}`)
            router.refresh()
          }}
          className="text-xs text-blue-600 hover:text-blue-700 underline"
        >
          Clear search
        </button>
      </div>
    )
  }

  if (!groupField) {
    // Check if there are any select fields available
    const selectFields = tableFields.filter(
      (f) => f.type === "single_select" || f.type === "multi_select"
    )
    
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center p-8 max-w-md">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Group Field Required
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Kanban view requires a field to group cards by. Please select a single-select or multi-select field to use as the grouping field.
          </p>
          {selectFields.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Available select fields:</p>
              <ul className="text-sm text-gray-700 space-y-1">
                {selectFields.map((field) => (
                  <li key={field.id} className="flex items-center justify-center gap-2">
                    <span className="font-medium">{field.name}</span>
                    <span className="text-xs text-gray-400">({field.type})</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 mt-4">
                Configure the group field in view settings
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              No select fields found. Create a single-select or multi-select field first.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="h-full min-w-0 bg-white overflow-y-auto overflow-x-auto [scrollbar-gutter:stable] pr-2">
          <div className="flex flex-nowrap gap-4 p-6 h-full min-w-max">
            {columns.map((column) => {
              const columnRows = groupedRows[column.id] || []
              const isCollapsed = collapsedColumns.has(column.id)

              return (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  rows={columnRows}
                  isCollapsed={isCollapsed}
                  onToggle={() => toggleColumn(column.id)}
                  onAddCard={() => handleAddCard(column.id)}
                  displayFields={displayCardFields}
                  showFieldLabels={showFieldLabels}
                  groupField={groupField}
                  canEdit={canEdit}
                  onCardSelect={(row) => setSelectedRowId(String(row.id))}
                  onCardOpen={handleOpenRow}
                  tableFields={tableFields}
                  selectedRowId={selectedRowId}
                  tableName={supabaseTableName}
                  onCellSave={handleCellSave}
                />
              )
            })}
          </div>
        </div>
        <DragOverlay>
          {activeId ? (
            <div className="bg-white rounded-lg shadow-xl border-2 border-blue-300 p-4 w-64 opacity-95">
              <div className="text-sm font-medium text-gray-900">Moving card...</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {canManageColumns && (
        <div className="absolute bottom-4 right-4">
          <Button
            onClick={() => setColumnManagementOpen(true)}
            className="shadow-lg"
          >
            Manage Columns
          </Button>
        </div>
      )}

      {canManageColumns && groupField && (
        <ColumnManagementDialog
          isOpen={columnManagementOpen}
          onClose={() => setColumnManagementOpen(false)}
          field={groupField}
          tableId={tableId}
          onFieldUpdated={async () => {
            await loadRows()
          }}
        />
      )}

      {openRow && (
        <RecordDrawer
          tableId={tableId}
          isOpen={!!openRow}
          onClose={() => setOpenRow(null)}
          tableName={supabaseTableName}
          rowId={openRow.id}
          fieldNames={tableFields.map((f) => f.name)}
          tableFields={tableFields}
          onSave={async () => {
            await loadRows()
            setOpenRow(null)
          }}
          onDelete={async () => {
            await loadRows()
            setOpenRow(null)
          }}
        />
      )}
    </>
  )
}

interface KanbanColumnProps {
  column: KanbanColumn
  rows: Record<string, any>[]
  isCollapsed: boolean
  onToggle: () => void
  onAddCard: () => void
  displayFields: TableField[]
  showFieldLabels?: boolean
  groupField: TableField
  canEdit: boolean
  onCardSelect: (row: Record<string, any>) => void
  onCardOpen: (row: Record<string, any>) => void
  tableFields: TableField[]
  selectedRowId: string | null
  tableName: string
  onCellSave: (rowId: string, fieldName: string, value: any) => Promise<void>
}

function KanbanColumn({
  column,
  rows,
  isCollapsed,
  onToggle,
  onAddCard,
  displayFields,
  showFieldLabels = false,
  groupField,
  canEdit,
  onCardSelect,
  onCardOpen,
  tableFields,
  selectedRowId,
  tableName,
  onCellSave,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: `column-${column.id}`,
    data: {
      type: "column",
      columnId: column.id,
    },
  })

  // Get column color from group field if it's a select field
  const getColumnColor = () => {
    if (groupField.type === 'single_select' || groupField.type === 'multi_select') {
      const hexColor = resolveChoiceColor(
        column.id,
        groupField.type,
        groupField.options,
        groupField.type === 'single_select'
      )
      return normalizeHexColor(hexColor)
    }
    return null
  }

  const columnColor = getColumnColor()
  const textColorClass = columnColor ? getTextColorForBackground(columnColor) : 'text-gray-900'

  return (
    <div
      ref={setNodeRef}
      className="flex-shrink-0 min-w-[260px] bg-gray-50 rounded-lg flex flex-col h-full max-h-full border border-gray-200"
      data-column-id={column.id}
    >
      {/* Column Header */}
      <div className="p-3 flex items-center justify-between flex-shrink-0 border-b border-gray-200">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 text-left hover:opacity-90 rounded px-2 py-1 -mx-2 -my-1 transition-opacity"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
          <span
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${textColorClass}`}
            style={columnColor ? { backgroundColor: columnColor } : { backgroundColor: '#9CA3AF' }}
          >
            {column.name}
            <span className={`${textColorClass} font-normal`}>{rows.length}</span>
          </span>
        </button>
      </div>

      {/* Cards */}
      {!isCollapsed && (
        <div className="flex-1 px-3 py-3 overflow-hidden min-h-0">
          <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {rows.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Drop cards here
                </div>
              ) : (
                rows.map((row) => (
                  <KanbanCard
                    key={row.id}
                    row={row}
                    displayFields={displayFields}
                    showFieldLabels={showFieldLabels}
                    tableFields={tableFields}
                    selected={selectedRowId === String(row.id)}
                    onSelect={() => onCardSelect(row)}
                    onOpen={() => onCardOpen(row)}
                    canEdit={canEdit}
                    tableName={tableName}
                    onCellSave={onCellSave}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </div>
      )}

      {/* Add Card Button */}
      {!isCollapsed && canEdit && (
        <div className="px-3 py-2 border-t border-gray-200 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddCard}
            className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add element
          </Button>
        </div>
      )}
    </div>
  )
}

interface KanbanCardProps {
  row: Record<string, any>
  displayFields: TableField[]
  showFieldLabels?: boolean
  tableFields: TableField[]
  selected: boolean
  onSelect: () => void
  onOpen: () => void
  canEdit: boolean
  tableName: string
  onCellSave: (rowId: string, fieldName: string, value: any) => Promise<void>
}

function KanbanCard({ row, displayFields, showFieldLabels = false, tableFields, selected, onSelect, onOpen, canEdit, tableName, onCellSave }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    disabled: !canEdit,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const list = Array.isArray(displayFields) ? displayFields : []
  const getFullField = (field: TableField): TableField => {
    if (!field || !tableFields) return field
    const fullField = tableFields.find((f) => f.id === field.id || f.name === field.name)
    return fullField || field
  }

  // Airtable-style: each field on its own row with set height, no fixed card size
  const FIELD_ROW_HEIGHT = 32
  const LONG_TEXT_ROW_HEIGHT = 48

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`group hover:shadow-md transition-all duration-200 bg-white border border-gray-200 rounded-lg shadow-sm cursor-default ${
        selected ? "ring-2 ring-blue-400/50 bg-blue-50/40" : ""
      }`}
      onClick={() => onSelect()}
      onDoubleClick={(e) => {
        const target = e.target as HTMLElement
        if (target.closest('[data-kanban-open="true"]')) return
        if (target.closest('[data-kanban-field="true"]')) return
        if (target.closest('[data-kanban-drag="true"]')) return
        onOpen()
      }}
    >
      <CardContent className="p-3 min-w-0">
        <div className="flex items-start gap-2 min-w-0">
          {canEdit && (
            <div
              {...attributes}
              {...listeners}
              data-kanban-drag="true"
              className="mt-0.5 cursor-grab active:cursor-grabbing flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <GripVertical className="h-4 w-4 text-gray-400" />
            </div>
          )}
          <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-3 gap-y-1">
            {list.map((field, idx) => {
              if (!field?.name) return null
              const full = getFullField(field)
              const value = row[full.name]
              const isFirst = idx === 0
              const isLongText = full.type === "long_text"
              const rowH = isLongText ? LONG_TEXT_ROW_HEIGHT : FIELD_ROW_HEIGHT
              return (
                <div
                  key={full.id ?? full.name}
                  className={`flex flex-col gap-0.5 min-w-0 ${isFirst ? "col-span-full font-semibold text-sm text-gray-900" : "text-xs text-gray-600"}`}
                  data-kanban-field="true"
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  {showFieldLabels && (
                    <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide shrink-0">
                      {getFieldDisplayName(full)}
                    </div>
                  )}
                  <div className={`flex items-center gap-1.5 min-w-0 flex-1`}>
                  <div className={`flex-1 min-w-0 overflow-hidden ${isLongText ? "line-clamp-2" : "truncate"}`}>
                    <CellFactory
                      field={full}
                      value={value}
                      rowId={String(row.id)}
                      tableName={tableName}
                      editable={canEdit && !full.options?.read_only && full.type !== "lookup" && full.type !== "formula"}
                      wrapText={true}
                      rowHeight={rowH}
                      onSave={(v) => onCellSave(String(row.id), full.name, v)}
                      pillTruncate={true}
                    />
                  </div>
                  {isFirst && (
                    <button
                      type="button"
                      data-kanban-open="true"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpen()
                      }}
                      className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50/60 transition-colors"
                      title="Open record"
                      aria-label="Open record"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
