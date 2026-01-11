"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useSearchParams } from "next/navigation"
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
  Edit,
  Trash2,
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
import type { TableField } from "@/types/fields"

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
  userRole = "editor",
}: AirtableKanbanViewProps) {
  const searchParams = useSearchParams()
  const searchQuery = searchParams.get("q") || ""
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(true)
  const [columns, setColumns] = useState<KanbanColumn[]>([])
  const [groupField, setGroupField] = useState<TableField | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingCard, setEditingCard] = useState<{ rowId: string; fieldName: string } | null>(null)
  const [cardValue, setCardValue] = useState("")
  const [selectedRow, setSelectedRow] = useState<Record<string, any> | null>(null)
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

  const loadColumns = useCallback((field: TableField) => {
    const choices = field.options?.choices || []
    const columnList: KanbanColumn[] = choices.map((choice, index) => ({
      id: choice,
      name: choice,
      collapsed: collapsedColumns.has(choice),
    }))
    setColumns(columnList)
  }, [collapsedColumns])

  // Find groupable field - require explicit selection, no auto-detection
  useEffect(() => {
    if (kanbanGroupField) {
      const field = tableFields.find((f) => f.name === kanbanGroupField)
      if (field && (field.type === "single_select" || field.type === "multi_select")) {
        setGroupField(field)
        loadColumns(field)
      } else {
        // Field not found or wrong type - clear group field
        setGroupField(null)
      }
    } else {
      // No group field specified - require user to select one
      setGroupField(null)
    }
  }, [kanbanGroupField, tableFields, loadColumns])

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

      // Apply sorting
      if (viewSorts.length > 0) {
        for (const sort of viewSorts) {
          query = query.order(sort.field_name, {
            ascending: sort.direction === "asc",
          })
        }
      } else {
        query = query.order("id", { ascending: false })
      }

      const { data, error } = await query

      if (error) {
        console.error("Error loading rows:", error)
        setRows([])
      } else {
        setRows(data || [])
      }
    } catch (error) {
      console.error("Error loading rows:", error)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [supabaseTableName, groupField, viewFilters, viewSorts])

  // Load rows
  useEffect(() => {
    if (supabaseTableName && groupField) {
      loadRows()
    }
  }, [supabaseTableName, groupField, loadRows])

  // Filter rows by search query
  const visibleFieldNames = useMemo(() => {
    return viewFields.filter((f) => f.visible).map((f) => f.field_name)
  }, [viewFields])

  const filteredRows = useMemo(() => {
    if (!searchQuery) return rows
    return filterRowsBySearch(rows, tableFields, searchQuery, visibleFieldNames)
  }, [rows, tableFields, searchQuery, visibleFieldNames])

  // Group rows by column
  const groupedRows = useMemo(() => {
    if (!groupField) return {}
    const groups: Record<string, typeof filteredRows> = {}
    filteredRows.forEach((row) => {
      const value = row[groupField.name]
      const columnValue = value || "—"
      if (!groups[columnValue]) {
        groups[columnValue] = []
      }
      groups[columnValue].push(row)
    })
    return groups
  }, [filteredRows, groupField])

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
      const { data, error } = await supabase
        .from(supabaseTableName)
        .insert([{ [groupField.name]: newValue }])
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

  // Get card fields to display
  const displayCardFields = useMemo(() => {
    // Ensure cardFields and tableFields are arrays
    const safeCardFields = Array.isArray(cardFields) ? cardFields : []
    const safeTableFields = Array.isArray(tableFields) ? tableFields : []
    
    if (safeCardFields.length > 0) {
      return safeCardFields
        .map((fieldName) => safeTableFields.find((f) => f && f.name === fieldName))
        .filter((f): f is TableField => f !== undefined && f !== null)
    }
    // Default: show first 3 visible fields (excluding group field)
    return safeTableFields
      .filter((f) => f && f.name !== groupField?.name)
      .slice(0, 3)
  }, [cardFields, tableFields, groupField])

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
            window.location.reload()
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
        <div className="h-full bg-gray-50 overflow-x-auto">
          <div className="flex gap-4 p-4 min-w-max h-full">
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
                  groupField={groupField}
                  canEdit={canEdit}
                  onCardClick={(row) => setSelectedRow(row)}
                  onCardEdit={(rowId, fieldName, value) => {
                    setEditingCard({ rowId, fieldName })
                    setCardValue(String(value || ""))
                  }}
                />
              )
            })}
          </div>
        </div>
        <DragOverlay>
          {activeId ? (
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-64">
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
            await loadColumns(groupField)
            await loadRows()
          }}
        />
      )}

      {selectedRow && (
        <RecordDrawer
          isOpen={!!selectedRow}
          onClose={() => setSelectedRow(null)}
          tableName={supabaseTableName}
          rowId={selectedRow.id}
          fieldNames={tableFields.map((f) => f.name)}
          tableFields={tableFields}
          onSave={async () => {
            await loadRows()
            setSelectedRow(null)
          }}
          onDelete={async () => {
            await loadRows()
            setSelectedRow(null)
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
  groupField: TableField
  canEdit: boolean
  onCardClick: (row: Record<string, any>) => void
  onCardEdit: (rowId: string, fieldName: string, value: any) => void
}

function KanbanColumn({
  column,
  rows,
  isCollapsed,
  onToggle,
  onAddCard,
  displayFields,
  groupField,
  canEdit,
  onCardClick,
  onCardEdit,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: `column-${column.id}`,
    data: {
      type: "column",
      columnId: column.id,
    },
  })

  return (
    <div
      ref={setNodeRef}
      className="flex-shrink-0 w-80 bg-gray-100 rounded-lg flex flex-col"
      data-column-id={column.id}
    >
      {/* Column Header */}
      <div className="p-3 bg-white rounded-t-lg border-b border-gray-200 flex items-center justify-between">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 text-left hover:bg-gray-50 rounded px-2 py-1 -mx-2 -my-1"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
          <span className="font-semibold text-sm text-gray-900">{column.name}</span>
          <span className="text-xs text-gray-500 ml-auto">{rows.length}</span>
        </button>
      </div>

      {/* Cards */}
      {!isCollapsed && (
        <div className="flex-1 px-2 py-2 overflow-y-auto min-h-[100px]">
          <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
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
                    onClick={() => onCardClick(row)}
                    onEdit={onCardEdit}
                    canEdit={canEdit}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </div>
      )}

      {/* Add Card Button */}
      {!isCollapsed && canEdit && (
        <div className="p-2 border-t border-gray-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddCard}
            className="w-full text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Card
          </Button>
        </div>
      )}
    </div>
  )
}

interface KanbanCardProps {
  row: Record<string, any>
  displayFields: TableField[]
  onClick: () => void
  onEdit: (rowId: string, fieldName: string, value: any) => void
  canEdit: boolean
}

function KanbanCard({ row, displayFields, onClick, onEdit, canEdit }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    disabled: !canEdit,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const primaryField = displayFields[0]
  const primaryValue = primaryField ? row[primaryField.name] : null

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="cursor-pointer hover:shadow-md transition-shadow bg-white border-gray-200"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          {canEdit && (
            <div
              {...attributes}
              {...listeners}
              className="mt-0.5 cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 text-gray-400" />
            </div>
          )}
          <div className="flex-1 space-y-2 min-w-0">
            {primaryField && (
              <div className="font-medium text-sm text-gray-900 truncate">
                {primaryValue || "Untitled"}
              </div>
            )}
            {Array.isArray(displayFields) && displayFields.slice(1).map((field) => {
              if (!field || !field.name) return null
              const value = row[field.name]
              return (
                <div key={field.name} className="text-xs text-gray-600 truncate">
                  <span className="text-gray-500">{field.name}:</span> {String(value || "—")}
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
