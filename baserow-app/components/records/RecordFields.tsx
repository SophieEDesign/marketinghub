"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { ChevronDown, ChevronRight, Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { useToast } from "@/components/ui/use-toast"
import InlineFieldEditor from "./InlineFieldEditor"
import type { TableField } from "@/types/fields"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"
import { getFieldDisplayName } from "@/lib/fields/display"
import { FIELD_LABEL_CLASS_NO_MARGIN, FIELD_LABEL_GAP_CLASS } from "@/lib/fields/field-label"
import { cn } from "@/lib/utils"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import SortableFieldItem from "./SortableFieldItem"

interface RecordFieldsProps {
  fields: TableField[]
  formData: Record<string, any>
  onFieldChange: (fieldName: string, value: any) => void
  fieldGroups: Record<string, string[]>
  tableId: string
  recordId: string
  isFieldEditable?: (fieldName: string) => boolean // Function to check if a field is editable
  tableName?: string // Supabase table name (optional, will be fetched if not provided)
  showFieldNames?: boolean // Show field titles above inputs (default true)
  // Layout mode props
  layoutMode?: boolean // Whether we're in layout editing mode
  fieldLayout?: FieldLayoutItem[] // Current field layout
  allFields?: TableField[] // All available fields (for adding new ones)
  onFieldVisibilityToggle?: (fieldName: string, visible: boolean) => void
  onFieldLayoutChange?: (layout: FieldLayoutItem[]) => void
  pageEditable?: boolean // For creating new layout items
}

const DEFAULT_GROUP_NAME = "General"
const SYSTEM_FIELD_NAMES = new Set(["created_at", "created_by", "updated_at", "updated_by"])
function isSystemFieldName(name: string) {
  return SYSTEM_FIELD_NAMES.has(String(name || "").toLowerCase())
}

// Get localStorage key for collapsed groups state
const getCollapsedGroupsKey = (tableId: string) => `record-view-collapsed-groups-${tableId}`

export default function RecordFields({
  fields,
  formData,
  onFieldChange,
  fieldGroups,
  tableId,
  recordId,
  isFieldEditable = () => true, // Default to all fields editable if not provided
  tableName: propTableName,
  showFieldNames = true,
  layoutMode = false,
  fieldLayout = [],
  allFields = [],
  onFieldVisibilityToggle,
  onFieldLayoutChange,
  pageEditable = true,
}: RecordFieldsProps) {
  const { navigateToLinkedRecord, openRecordByTableId, state: recordPanelState } = useRecordPanel()
  const { toast } = useToast()
  const [editingField, setEditingField] = useState<string | null>(null)
  const [tableName, setTableName] = useState<string | undefined>(propTableName)
  const supabase = createClient()
  const columnsContainerRef = useRef<HTMLDivElement | null>(null)

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: `log_${Date.now()}_recordfields_render_start`,
      timestamp: Date.now(),
      runId: 'rf-pre-fix',
      hypothesisId: 'RF1',
      location: 'RecordFields.tsx:render START',
      message: 'RecordFields render START',
      data: {
        tableId,
        recordId,
        layoutMode,
        fieldsCount: fields.length,
        fieldLayoutCount: fieldLayout.length,
        allFieldsCount: allFields.length,
      },
    }),
  }).catch(() => {})
  // #endregion

  // Load collapsed groups state from localStorage
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try {
      const stored = localStorage.getItem(getCollapsedGroupsKey(tableId))
      if (stored) {
        return new Set(JSON.parse(stored))
      }
    } catch (error) {
      console.warn("Failed to load collapsed groups from localStorage:", error)
    }
    return new Set()
  })

  // Persist collapsed groups state to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      localStorage.setItem(
        getCollapsedGroupsKey(tableId),
        JSON.stringify(Array.from(collapsedGroups))
      )
    } catch (error) {
      console.warn("Failed to save collapsed groups to localStorage:", error)
    }
  }, [collapsedGroups, tableId])

  // Fetch table name if not provided
  useEffect(() => {
    if (!tableName && tableId) {
      supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", tableId)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setTableName(data.supabase_table)
          }
        })
    }
  }, [tableId, tableName, supabase])

  // Group and sort fields based on metadata (fallback mode – used when no modal columns are defined)
  const groupedFields = useMemo(() => {
    // Build field-to-group mapping from fieldGroups prop (legacy support)
    const fieldToGroupMap: Record<string, string> = {}
    Object.entries(fieldGroups).forEach(([groupName, fieldNames]) => {
      fieldNames.forEach((fieldName) => {
        fieldToGroupMap[fieldName] = groupName
      })
    })

    // Create layout order map if in layout mode
    const layoutOrderMap = new Map<string, number>()
    if (layoutMode && fieldLayout.length > 0) {
      fieldLayout.forEach((item, index) => {
        layoutOrderMap.set(item.field_name, item.order)
      })
    }

    // Group all fields - use field.group_name as primary source, fallback to fieldGroups prop.
    // System fields are shown in the dedicated Activity section (RecordActivity), not as raw fields.
    const groups: Record<string, TableField[]> = {}

    fields
      .filter((field) => !isSystemFieldName(field.name) && !field.options?.system)
      .forEach((field) => {
      // Priority: field.group_name > fieldGroups prop > DEFAULT_GROUP_NAME
      const groupName = field.group_name || fieldToGroupMap[field.name] || DEFAULT_GROUP_NAME

      if (!groups[groupName]) {
        groups[groupName] = []
      }
      groups[groupName].push(field)
    })

    // Sort fields within each group
    Object.keys(groups).forEach((groupName) => {
      groups[groupName].sort((a, b) => {
        // In layout mode, use fieldLayout order
        if (layoutMode && layoutOrderMap.size > 0) {
          const orderA = layoutOrderMap.get(a.name) ?? 9999
          const orderB = layoutOrderMap.get(b.name) ?? 9999
          return orderA - orderB
        }
        // Otherwise use order_index (fallback to position)
        const orderA = a.order_index ?? a.position ?? 0
        const orderB = b.order_index ?? b.position ?? 0
        return orderA - orderB
      })
    })

    // Sort groups by minimum order_index of fields in each group
    // "General" group always appears first if it exists
    const sortedGroupEntries = Object.entries(groups).sort(([nameA, fieldsA], [nameB, fieldsB]) => {
      // "General" group always first
      if (nameA === DEFAULT_GROUP_NAME) return -1
      if (nameB === DEFAULT_GROUP_NAME) return 1

      // Otherwise, sort by minimum order_index in each group
      const minOrderA = Math.min(...fieldsA.map((f) => {
        if (layoutMode && layoutOrderMap.size > 0) {
          return layoutOrderMap.get(f.name) ?? 9999
        }
        return f.order_index ?? f.position ?? 0
      }))
      const minOrderB = Math.min(...fieldsB.map((f) => {
        if (layoutMode && layoutOrderMap.size > 0) {
          return layoutOrderMap.get(f.name) ?? 9999
        }
        return f.order_index ?? f.position ?? 0
      }))
      return minOrderA - minOrderB
    })

    return Object.fromEntries(sortedGroupEntries)
  }, [fields, fieldGroups, layoutMode, fieldLayout])

  // Modal column-aware layout metadata (used by record modal / side panel only).
  // We keep this entirely derived from fieldLayout so that field_layout remains
  // the single source of truth. Page canvas / block layout never read these
  // modal-specific properties.
  const hasModalColumns = useMemo(
    () => fieldLayout.some((item) => item.modal_column_id),
    [fieldLayout]
  )

  type ModalColumn = {
    id: string
    order: number
    width: number
    fields: TableField[]
  }

  const modalColumns: ModalColumn[] = useMemo(() => {
    // If there is no layout at all, fall back to a single implicit column based on fields order.
    if (!fieldLayout.length) {
      const ordered = [...fields].filter(
        (field) => !isSystemFieldName(field.name) && !field.options?.system
      )
      return ordered.length
        ? [
            {
              id: "col-1",
              order: 0,
              width: 1,
              fields: ordered,
            },
          ]
        : []
    }

    // Build field lookup for safety
    const fieldMap = new Map<string, TableField>()
    fields.forEach((field) => {
      fieldMap.set(field.name, field)
      fieldMap.set(field.id, field)
    })

    // Build column buckets from layout metadata, defaulting missing columns to col-1.
    const byColumn = new Map<
      string,
      { id: string; order: number; width: number; fieldOrder: Array<{ order: number; field: TableField }> }
    >()
    const seenFieldNames = new Set<string>()

    fieldLayout.forEach((item) => {
      // Only respect modal visibility in modal canvas
      if (item.visible_in_modal === false) return

      const colId = item.modal_column_id || "col-1"
      const colOrder = item.modal_column_order ?? 0
      const colWidth = item.modal_column_width ?? 1
      const field = fieldMap.get(item.field_name) || fieldMap.get(item.field_id)
      if (!field || isSystemFieldName(field.name) || field.options?.system) {
        return
      }
      // Ensure each logical field participates in the modal canvas at most once,
      // even if field_layout contains duplicate items.
      if (seenFieldNames.has(field.name)) {
        return
      }
      seenFieldNames.add(field.name)

      if (!byColumn.has(colId)) {
        byColumn.set(colId, { id: colId, order: colOrder, width: colWidth, fieldOrder: [] })
      }
      byColumn.get(colId)!.fieldOrder.push({ order: item.order, field })
    })

    const columns = Array.from(byColumn.values())
      .map((col) => ({
        id: col.id,
        order: col.order,
        width: col.width || 1,
        fields: col.fieldOrder
          .sort((a, b) => a.order - b.order)
          .map((f) => f.field),
      }))
      .sort((a, b) => a.order - b.order)

    // If we somehow didn't get any columns from layout, fall back to single column.
    if (!columns.length) {
      const ordered = [...fields].filter(
        (field) => !isSystemFieldName(field.name) && !field.options?.system
      )
      return ordered.length
        ? [
            {
              id: "col-1",
              order: 0,
              width: 1,
              fields: ordered,
            },
          ]
        : []
    }

    return columns
  }, [fieldLayout, fields])

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

  const handleLinkedRecordClick = useCallback(
    async (linkedTableId: string, linkedRecordId: string) => {
      try {
        // Never open the current record (self-link edge case)
        if (linkedTableId === tableId && linkedRecordId === recordId) {
          return
        }

        const supabase = createClient()
        const { data: linkedTable } = await supabase
          .from("tables")
          .select("name, supabase_table")
          .eq("id", linkedTableId)
          .single()

        // CRITICAL: Preserve interfaceMode when opening linked records (Airtable-style)
        const interfaceMode = recordPanelState.interfaceMode ?? 'view'
        if (linkedTable && navigateToLinkedRecord) {
          navigateToLinkedRecord(linkedTableId, linkedRecordId, linkedTable.supabase_table, interfaceMode)
        } else {
          openRecordByTableId(linkedTableId, linkedRecordId, interfaceMode)
        }
      } catch (error: any) {
        console.error("Error navigating to linked record:", error)
        toast({
          title: "Failed to open linked record",
          description: error.message || "Please try again",
          variant: "destructive",
        })
      }
    },
    [navigateToLinkedRecord, openRecordByTableId, toast, recordPanelState.interfaceMode]
  )

  const handleAddLinkedRecord = useCallback(
    async (field: TableField) => {
      const linkedTableId = field.options?.linked_table_id
      if (!linkedTableId) return

      // For now, show a toast - in future, open a modal to select/create record
      toast({
        title: "Add linked record",
        description: "This feature will open a record picker.",
      })
    },
    [toast]
  )

  // Drag and drop sensors for layout mode
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Get visibility for a field in layout mode
  const isFieldVisibleInLayout = useCallback(
    (fieldName: string): boolean => {
      if (!layoutMode || fieldLayout.length === 0) return true
      const layoutItem = fieldLayout.find((item) => item.field_name === fieldName)
      // Modal canvas uses visible_in_modal as the source of truth
      return layoutItem ? layoutItem.visible_in_modal !== false : true
    },
    [layoutMode, fieldLayout]
  )

  // SortableFieldItem is now extracted to a separate component file
  // to ensure stable hook order (always calls useSortable, disabled when layoutMode is false)

  // Handle drag end in layout mode (multi-column, modal-style)
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!layoutMode || !onFieldLayoutChange || !fieldLayout.length) return

      const { active, over } = event
      if (!over || active.id === over.id) return

      const activeId = String(active.id)
      const overId = String(over.id)

      // Find source/target columns based on field ids
      let sourceColumnId: string | null = null
      let targetColumnId: string | null = null

      modalColumns.forEach((col) => {
        const hasActive = col.fields.some((f) => f.id === activeId)
        const hasOver = col.fields.some((f) => f.id === overId)
        if (hasActive) sourceColumnId = col.id
        if (hasOver) targetColumnId = col.id
      })

      if (!sourceColumnId || !targetColumnId) return

      const sourceCol = modalColumns.find((c) => c.id === sourceColumnId)
      const targetCol = modalColumns.find((c) => c.id === targetColumnId)
      if (!sourceCol || !targetCol) return

      const activeField = sourceCol.fields.find((f) => f.id === activeId)
      if (!activeField) return

      const newTargetFields = [...targetCol.fields]
      const existingIndex = newTargetFields.findIndex((f) => f.id === activeId)
      if (existingIndex !== -1) {
        newTargetFields.splice(existingIndex, 1)
      }

      const overIndex = newTargetFields.findIndex((f) => f.id === overId)
      const insertIndex = overIndex === -1 ? newTargetFields.length : overIndex
      newTargetFields.splice(insertIndex, 0, activeField)

      const updatedLayout: FieldLayoutItem[] = fieldLayout.map((item) => {
        if (item.field_name === activeField.name || item.field_id === activeField.id) {
          return {
            ...item,
            modal_column_id: targetCol.id,
          }
        }
        return item
      })

      // Recompute order for all items, respecting column order and within-column order
      let globalOrder = 0
      const columnOrderMap = new Map<string, TableField[]>()
      modalColumns.forEach((col) => {
        if (col.id === targetCol.id) {
          columnOrderMap.set(col.id, newTargetFields)
        } else {
          columnOrderMap.set(col.id, col.fields)
        }
      })

      const orderedColumns = [...modalColumns].sort((a, b) => a.order - b.order)

      const finalLayout = updatedLayout.map((item) => {
        const colId = item.modal_column_id || "col-1"
        const col = orderedColumns.find((c) => c.id === colId)
        const colFields = columnOrderMap.get(colId) || col?.fields || []
        const idx = colFields.findIndex(
          (f) => f.name === item.field_name || f.id === item.field_id
        )
        const nextOrder = idx === -1 ? globalOrder : globalOrder + idx
        return {
          ...item,
          order: nextOrder,
        }
      })

      onFieldLayoutChange(finalLayout)
    },
    [layoutMode, onFieldLayoutChange, fieldLayout, modalColumns]
  )

  // Handle adding a field in layout mode
  const handleAddField = useCallback(
    (field: TableField, targetColumnId?: string) => {
      if (!layoutMode || !onFieldLayoutChange || !fieldLayout) return

      // Check if field already exists in layout
      const exists = fieldLayout.some((item) => item.field_name === field.name)
      if (exists) {
        // Just make it visible
        onFieldVisibilityToggle?.(field.name, true)
        return
      }

      // Add field to layout in the target column (default first column)
      const maxOrder = Math.max(...fieldLayout.map((item) => item.order), -1)
      const columnId = targetColumnId || (modalColumns[0]?.id ?? "col-1")
      const newItem: FieldLayoutItem = {
        field_id: field.id,
        field_name: field.name,
        order: maxOrder + 1,
        visible_in_modal: true,
        editable: pageEditable ?? true,
        group_name: field.group_name ?? undefined,
        modal_column_id: columnId,
      }

      const updatedLayout = [...fieldLayout, newItem]
      onFieldLayoutChange?.(updatedLayout)
    },
    [layoutMode, onFieldLayoutChange, fieldLayout, onFieldVisibilityToggle, pageEditable]
  )

  // Get available fields that aren't in the layout
  const availableFields = useMemo(() => {
    if (!layoutMode || !allFields.length) return []
    const layoutFieldNames = new Set(fieldLayout.map((item) => item.field_name))
    return allFields.filter(
      (field) =>
        !isSystemFieldName(field.name) &&
        !field.options?.system &&
        !layoutFieldNames.has(field.name)
    )
  }, [layoutMode, allFields, fieldLayout])

  // Detect invalid layout items (fields that no longer exist) once and render
  // a single inline error card instead of crashing the modal.
  const hasInvalidLayoutItems = useMemo(() => {
    if (!fieldLayout.length || !allFields.length) return false
    const fieldKeys = new Set<string>()
    allFields.forEach((f) => {
      fieldKeys.add(f.id)
      fieldKeys.add(f.name)
    })
    return fieldLayout.some(
      (item) => !fieldKeys.has(item.field_id) && !fieldKeys.has(item.field_name)
    )
  }, [fieldLayout, allFields])

  // Validate field before rendering - prevent #ERROR! states
  const validateField = useCallback((field: TableField): boolean => {
    if (!field || !field.id || !field.name) {
      return false
    }
    // Ensure field exists in allFields if in layout mode (single source of truth)
    if (layoutMode && allFields.length > 0) {
      const existsInAllFields = allFields.some(
        (f) => f.id === field.id || f.name === field.name
      )
      if (!existsInAllFields) {
        return false
      }
    }
    return true
  }, [layoutMode, allFields])

  const renderField = useCallback(
    (field: TableField) => {
      // Validate field before rendering
      if (!validateField(field)) {
        return (
          <div
            key={field.id || field.name}
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <div className="font-medium">Invalid field: {field.name || "Unknown"}</div>
            <div className="text-xs text-red-600 mt-1">
              This field may have been deleted or is not available.
            </div>
          </div>
        )
      }

      const fieldEditable = isFieldEditable(field.name)
      const isThisEditing = editingField === field.id
      const isVisible = layoutMode ? isFieldVisibleInLayout(field.name) : true

      const fieldContent = (
        <div
          className={cn(
            "rounded-md hover:bg-gray-50/50 transition-colors px-1 py-0.5 -mx-1 min-w-0",
            FIELD_LABEL_GAP_CLASS,
            layoutMode && !isVisible && "opacity-50"
          )}
        >
          {showFieldNames && (
            <label className={cn(FIELD_LABEL_CLASS_NO_MARGIN, "flex-shrink-0")}>
              {getFieldDisplayName(field)}
            </label>
          )}
          <div className="min-w-0">
            <InlineFieldEditor
              field={field}
              value={formData[field.name]}
              onChange={(value) => onFieldChange(field.name, value)}
              isEditing={isThisEditing}
              onEditStart={() => {
                if (!fieldEditable || layoutMode) return // Lock fields in layout mode
                setEditingField(field.id)
              }}
              onEditEnd={() => {
                setEditingField((prev) => (prev === field.id ? null : prev))
              }}
              onLinkedRecordClick={handleLinkedRecordClick}
              onAddLinkedRecord={handleAddLinkedRecord}
              isReadOnly={!fieldEditable || layoutMode} // Lock fields in layout mode
              showLabel={false}
              tableId={tableId}
              recordId={recordId}
              tableName={tableName}
            />
          </div>
        </div>
      )

      // CRITICAL FIX: Always render SortableFieldItem to maintain stable hook order
      // The component internally disables sortable behavior when layoutMode is false
      // This prevents React #185 (hook order violation) when layoutMode changes
      return (
        <SortableFieldItem 
          key={field.id} 
          field={field} 
          isVisible={isVisible}
          layoutMode={layoutMode}
          onFieldVisibilityToggle={onFieldVisibilityToggle}
        >
          {fieldContent}
        </SortableFieldItem>
      )
    },
    [
      isFieldEditable,
      editingField,
      layoutMode,
      isFieldVisibleInLayout,
      showFieldNames,
      formData,
      onFieldChange,
      handleLinkedRecordClick,
      handleAddLinkedRecord,
      tableId,
      recordId,
      tableName,
      validateField,
    ]
  )

  const showModalColumns = modalColumns.length > 0

  // Stable canonical field list: same set/order every time so SortableFieldItem count never changes.
  // We also keep groupName here so group headers are purely cosmetic and do NOT affect hook call order.
  const canonicalFieldItems = useMemo(
    () =>
      Object.entries(groupedFields).flatMap(([groupName, groupFields]) =>
        groupFields.map((field) => ({ field, groupName }))
      ),
    [groupedFields]
  )
  const canonicalFieldIds = useMemo(
    () => canonicalFieldItems.map((item) => item.field.id),
    [canonicalFieldItems]
  )

  // For modal column layout: which grid column (1-based) each field belongs to.
  const fieldToColumnIndex = useMemo(() => {
    const map: Record<string, number> = {}
    modalColumns.forEach((col, i) =>
      col.fields.forEach((f) => {
        map[f.id] = i + 1
      })
    )
    return map
  }, [modalColumns])

  // Compute CSS grid template for modal columns based on relative widths.
  const gridTemplateColumns = useMemo(() => {
    if (!showModalColumns) return undefined
    const total = modalColumns.reduce((sum, col) => sum + (col.width || 1), 0)
    if (!total) return undefined
    return modalColumns
      .map((col) => `${(col.width || 1) / total}fr`)
      .join(" ")
  }, [showModalColumns, modalColumns])

  // Column resize handler (layout mode only)
  const startResize = (leftColIndex: number) => {
    if (!layoutMode || !onFieldLayoutChange) return
    const container = columnsContainerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const startWidths = modalColumns.map((c) => c.width || 1)

    const handleMouseMove = (e: MouseEvent) => {
      const deltaPx = e.clientX - rect.left
      const fraction = deltaPx / rect.width
      if (!Number.isFinite(fraction)) return

      const left = modalColumns[leftColIndex]
      const right = modalColumns[leftColIndex + 1]
      if (!left || !right) return

      const totalPair = startWidths[leftColIndex] + startWidths[leftColIndex + 1]
      let newLeftWidth = Math.max(0.1, Math.min(totalPair - 0.1, fraction * totalPair))
      let newRightWidth = totalPair - newLeftWidth

      const nextWidths = [...startWidths]
      nextWidths[leftColIndex] = newLeftWidth
      nextWidths[leftColIndex + 1] = newRightWidth

      const layoutByColumn: Record<string, number> = {}
      modalColumns.forEach((col, idx) => {
        layoutByColumn[col.id] = nextWidths[idx] || 1
      })

      const updated = fieldLayout.map((item) => {
        const colId = item.modal_column_id || "col-1"
        return {
          ...item,
          modal_column_id: colId,
          modal_column_width: layoutByColumn[colId] ?? item.modal_column_width ?? 1,
        }
      })
      onFieldLayoutChange(updated)
    }

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
  }

  return (
    <div className="space-y-8">
      {hasInvalidLayoutItems && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <div className="font-medium">Some fields in this layout no longer exist.</div>
          <div className="text-xs text-red-600 mt-1">
            The layout still loaded safely. You can remove or replace missing fields in layout
            edit mode.
          </div>
        </div>
      )}

      {/* CRITICAL: Single stable tree to prevent React #185. Do not mount DndContext with 0
          fields so hook count never changes from 0 to N. */}
      {canonicalFieldItems.length === 0 ? (
        <div className="space-y-3" />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={showModalColumns && layoutMode ? handleDragEnd : undefined}
        >
          {/* Single SortableContext + exactly N SortableFieldItems. Layout (grid vs grouped) is cosmetic only. */}
          <SortableContext
            items={canonicalFieldIds}
            strategy={verticalListSortingStrategy}
          >
            <div
              ref={columnsContainerRef}
              className={showModalColumns ? "grid gap-6" : "space-y-3"}
              style={
                showModalColumns && gridTemplateColumns
                  ? { gridTemplateColumns }
                  : undefined
              }
            >
              {canonicalFieldItems.map((item, index) => {
                const prevGroupName =
                  index > 0 ? canonicalFieldItems[index - 1].groupName : null
                const isFirstInGroup = item.groupName !== prevGroupName
                const isCollapsed = collapsedGroups.has(item.groupName)

                return (
                  <div
                    key={item.field.id}
                    className={cn(
                      showModalColumns &&
                        "min-w-0 border-l border-gray-200 first:border-l-0 pl-4"
                    )}
                    style={
                      showModalColumns && fieldToColumnIndex[item.field.id]
                        ? { gridColumn: fieldToColumnIndex[item.field.id] }
                        : undefined
                    }
                  >
                    {/* Group header slot: always present so hook tree is stable; visibility via CSS only. */}
                    <div
                      className={cn(
                        showModalColumns || !isFirstInGroup ? "hidden" : ""
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleGroup(item.groupName)}
                        className="w-full flex items-center justify-between text-left py-2.5 px-3 -mx-3 mb-2 rounded-md bg-gray-100 border border-gray-200 hover:bg-gray-200 hover:border-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                        aria-expanded={!isCollapsed}
                        aria-label={`${
                          isCollapsed ? "Expand" : "Collapse"
                        } ${item.groupName} group`}
                      >
                        <span className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                          {item.groupName}
                        </span>
                        <span className="text-gray-500">
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </span>
                      </button>
                    </div>

                    {/* Field content: always rendered; visibility controlled via CSS only. */}
                    <div
                      className={
                        !showModalColumns && isCollapsed
                          ? "hidden"
                          : "space-y-3"
                      }
                    >
                      {renderField(item.field)}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Layout-mode-only UI: Add field + column resize (no hooks, safe to vary). */}
            {layoutMode && showModalColumns && availableFields.length > 0 && (
              <div className="pt-2 mt-2 border-t border-dashed border-gray-200 flex flex-wrap gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-full">
                  Add field
                </span>
                {availableFields.slice(0, 6).map((field) => (
                  <button
                    key={field.id}
                    type="button"
                    onClick={() => handleAddField(field, modalColumns[0]?.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-700"
                  >
                    <Plus className="h-3 w-3" />
                    {getFieldDisplayName(field)}
                  </button>
                ))}
                {availableFields.length > 6 && (
                  <span className="text-xs text-gray-500 self-center">
                    +{availableFields.length - 6} more
                  </span>
                )}
              </div>
            )}
          </SortableContext>
        </DndContext>
      )}

      {/* Empty State */}
      {fields.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No fields available
        </div>
      )}
    </div>
  )
}

