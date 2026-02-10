"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { ChevronDown, ChevronRight, GripVertical, Eye, EyeOff, Plus } from "lucide-react"
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

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
  onFieldReorder?: (fieldName: string, newIndex: number) => void
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
  onFieldReorder,
  onFieldVisibilityToggle,
  onFieldLayoutChange,
  pageEditable = true,
}: RecordFieldsProps) {
  const { navigateToLinkedRecord, openRecordByTableId, state: recordPanelState } = useRecordPanel()
  const { toast } = useToast()
  const [editingField, setEditingField] = useState<string | null>(null)
  const [tableName, setTableName] = useState<string | undefined>(propTableName)
  const supabase = createClient()

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

  // Group and sort fields based on metadata
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

  // Handle drag end in layout mode
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!layoutMode || !onFieldReorder) return

      const { active, over } = event
      if (!over || active.id === over.id) return

      const activeField = flatFieldsForDrag.find((f) => f.id === active.id)
      if (!activeField) return

      const oldIndex = flatFieldsForDrag.findIndex((f) => f.id === active.id)
      const newIndex = flatFieldsForDrag.findIndex((f) => f.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        onFieldReorder(activeField.name, newIndex)
      }
    },
    [layoutMode, onFieldReorder, flatFieldsForDrag]
  )

  // Handle adding a field in layout mode
  const handleAddField = useCallback(
    (field: TableField) => {
      if (!layoutMode || !onFieldLayoutChange || !fieldLayout) return

      // Check if field already exists in layout
      const exists = fieldLayout.some((item) => item.field_name === field.name)
      if (exists) {
        // Just make it visible
        handleFieldVisibilityToggle?.(field.name, true)
        return
      }

      // Add field to layout
      const maxOrder = Math.max(...fieldLayout.map((item) => item.order), -1)
      const newItem: FieldLayoutItem = {
        field_id: field.id,
        field_name: field.name,
        order: maxOrder + 1,
        visible_in_canvas: true,
        editable: pageEditable ?? true,
        group_name: field.group_name ?? undefined,
      }

      const updatedLayout = [...fieldLayout, newItem]
      onFieldLayoutChange?.(updatedLayout)
    },
    [layoutMode, onFieldLayoutChange, fieldLayout, handleFieldVisibilityToggle, pageEditable]
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

  // Get visibility for a field in layout mode
  const isFieldVisibleInLayout = useCallback(
    (fieldName: string): boolean => {
      if (!layoutMode || fieldLayout.length === 0) return true
      const layoutItem = fieldLayout.find((item) => item.field_name === fieldName)
      return layoutItem ? layoutItem.visible_in_canvas !== false : true
    },
    [layoutMode, fieldLayout]
  )

  // Sortable field item component for layout mode
  function SortableFieldItem({
    field,
    children,
    isVisible,
  }: {
    field: TableField
    children: React.ReactNode
    isVisible: boolean
  }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: field.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "relative group",
          !isVisible && "opacity-50"
        )}
      >
        {layoutMode && (
          <div className="absolute left-0 top-0 bottom-0 flex items-center z-10">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1"
            >
              <GripVertical className="h-4 w-4" />
            </div>
            {onFieldVisibilityToggle && (
              <button
                type="button"
                onClick={() => onFieldVisibilityToggle(field.name, !isVisible)}
                className="p-1 text-gray-400 hover:text-gray-600"
                title={isVisible ? "Hide field" : "Show field"}
              >
                {isVisible ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        )}
        <div className={cn(layoutMode && "ml-10")}>
          {children}
        </div>
      </div>
    )
  }

  // Flatten fields for drag and drop (layout mode only) - respect layout order
  const flatFieldsForDrag = useMemo(() => {
    if (!layoutMode) return []
    
    // Create order map from fieldLayout
    const orderMap = new Map<string, number>()
    fieldLayout.forEach((item) => {
      orderMap.set(item.field_name, item.order)
    })
    
    // Flatten and sort by layout order
    const flat = Object.values(groupedFields).flat()
    return flat.sort((a, b) => {
      const orderA = orderMap.get(a.name) ?? 9999
      const orderB = orderMap.get(b.name) ?? 9999
      return orderA - orderB
    })
  }, [layoutMode, groupedFields, fieldLayout])

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

      if (layoutMode) {
        const isVisible = isFieldVisibleInLayout(field.name)
        return (
          <SortableFieldItem key={field.id} field={field} isVisible={isVisible}>
            {fieldContent}
          </SortableFieldItem>
        )
      }

      return (
        <div key={field.id}>
          {fieldContent}
        </div>
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

  return (
    <div className="space-y-8">
      {layoutMode && flatFieldsForDrag.length > 0 ? (
        // Layout mode: Single sortable list
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={flatFieldsForDrag.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {flatFieldsForDrag.map((field) => renderField(field))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        // View mode: Grouped fields
        Object.entries(groupedFields)
          .filter(([_, groupFields]) => groupFields.length > 0) // Hide empty groups
          .map(([groupName, groupFields]) => {
            const isCollapsed = collapsedGroups.has(groupName)
            return (
              <section key={groupName} className="space-y-3">
                <button
                  onClick={() => toggleGroup(groupName)}
                  className="w-full flex items-center justify-between text-left py-2.5 px-3 -mx-3 rounded-md bg-gray-100 border border-gray-200 hover:bg-gray-200 hover:border-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                  aria-expanded={!isCollapsed}
                  aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${groupName} group`}
                >
                  <span className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{groupName}</span>
                  <span className="text-gray-500">
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="space-y-3">
                    {groupFields.map((field) => renderField(field))}
                  </div>
                )}
              </section>
            )
          })
      )}

      {/* Add Field Button (Layout Mode) */}
      {layoutMode && availableFields.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Add Field
          </div>
          <div className="flex flex-wrap gap-2">
            {availableFields.slice(0, 10).map((field) => (
              <button
                key={field.id}
                type="button"
                onClick={() => handleAddField(field)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-700"
              >
                <Plus className="h-3 w-3" />
                {getFieldDisplayName(field)}
              </button>
            ))}
            {availableFields.length > 10 && (
              <span className="text-xs text-gray-500 self-center">
                +{availableFields.length - 10} more
              </span>
            )}
          </div>
        </div>
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

