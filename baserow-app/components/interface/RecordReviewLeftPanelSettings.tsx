"use client"

/**
 * Record Review Left Panel Settings Component
 * 
 * This component allows users to configure which fields appear in the left column
 * of a Record Review page. This is page-level configuration, not block configuration.
 * 
 * Settings are stored in: page.settings.leftPanel
 */

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { GripVertical, Eye, EyeOff, Settings } from "lucide-react"
import { useSelectionContext } from "@/contexts/SelectionContext"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface RecordReviewLeftPanelSettingsProps {
  tableId: string | null
  currentSettings?: {
    visibleFieldIds: string[]
    fieldOrder?: string[]
    showLabels?: boolean
    compact?: boolean
  }
  onSettingsChange: (settings: {
    visibleFieldIds: string[]
    fieldOrder: string[]
    showLabels: boolean
    compact: boolean
  }) => void
}

export default function RecordReviewLeftPanelSettings({
  tableId,
  currentSettings,
  onSettingsChange,
}: RecordReviewLeftPanelSettingsProps) {
  const [fields, setFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(false)
  const [visibleFieldIds, setVisibleFieldIds] = useState<string[]>(
    currentSettings?.visibleFieldIds || []
  )
  const [fieldOrder, setFieldOrder] = useState<string[]>(
    currentSettings?.fieldOrder || []
  )
  const [showLabels, setShowLabels] = useState(currentSettings?.showLabels ?? true)
  const [compact, setCompact] = useState(currentSettings?.compact ?? false)
  const { setSelectedContext } = useSelectionContext()

  // Load fields from table
  useEffect(() => {
    if (!tableId) return

    async function loadFields() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from("table_fields")
          .select("*")
          .eq("table_id", tableId)
          .order("order_index", { ascending: true })

        if (data) {
          setFields(data as TableField[])
          
          // Initialize fieldOrder if not set (use table field order)
          if (fieldOrder.length === 0 && data.length > 0) {
            setFieldOrder(data.map(f => f.id))
          }
          
          // Initialize visibleFieldIds if not set (show all fields)
          if (visibleFieldIds.length === 0 && data.length > 0) {
            setVisibleFieldIds(data.map(f => f.id))
          }
        }
      } catch (error) {
        console.error("Error loading fields:", error)
      } finally {
        setLoading(false)
      }
    }

    loadFields()
  }, [tableId])

  // Get ordered fields based on fieldOrder
  const orderedFields = useMemo(() => {
    if (fieldOrder.length === 0) {
      return fields
    }
    
    // Sort fields by fieldOrder, then append any fields not in fieldOrder
    const ordered = fieldOrder
      .map(id => fields.find(f => f.id === id))
      .filter((f): f is TableField => f !== undefined)
    
    const unordered = fields.filter(f => !fieldOrder.includes(f.id))
    
    return [...ordered, ...unordered]
  }, [fields, fieldOrder])

  // Handle field visibility toggle
  const handleFieldToggle = (fieldId: string) => {
    const newVisibleIds = visibleFieldIds.includes(fieldId)
      ? visibleFieldIds.filter(id => id !== fieldId)
      : [...visibleFieldIds, fieldId]
    
    setVisibleFieldIds(newVisibleIds)
    notifySettingsChange(newVisibleIds, fieldOrder, showLabels, compact)
  }

  // Set up drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end (reorder fields)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const currentOrder = fieldOrder.length > 0 ? fieldOrder : fields.map(f => f.id)
    const oldIndex = currentOrder.indexOf(active.id as string)
    const newIndex = currentOrder.indexOf(over.id as string)

    const newOrder = arrayMove(currentOrder, oldIndex, newIndex)
    setFieldOrder(newOrder)
    notifySettingsChange(visibleFieldIds, newOrder, showLabels, compact)
  }

  // Notify parent of settings change
  const notifySettingsChange = (
    visibleIds: string[],
    order: string[],
    labels: boolean,
    compactMode: boolean
  ) => {
    onSettingsChange({
      visibleFieldIds: visibleIds,
      fieldOrder: order,
      showLabels: labels,
      compact: compactMode,
    })
  }

  // Handle display options change
  const handleShowLabelsChange = (checked: boolean) => {
    setShowLabels(checked)
    notifySettingsChange(visibleFieldIds, fieldOrder, checked, compact)
  }

  const handleCompactChange = (checked: boolean) => {
    setCompact(checked)
    notifySettingsChange(visibleFieldIds, fieldOrder, showLabels, checked)
  }

  if (!tableId) {
    return (
      <div className="p-4 text-sm text-gray-500">
        No table selected. Please select a table in page settings.
      </div>
    )
  }

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Loading fields...</div>
  }

  if (fields.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500">
        No fields found in this table.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-semibold">Visible Fields</Label>
        <p className="text-xs text-gray-500 mt-1 mb-3">
          Choose which fields appear in the left column. Drag to reorder.
        </p>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={orderedFields.map(f => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {orderedFields.map((field) => {
                const isVisible = visibleFieldIds.includes(field.id)
                return (
                  <SortableFieldItem
                    key={field.id}
                    field={field}
                    isVisible={isVisible}
                    onToggle={() => handleFieldToggle(field.id)}
                    onConfigure={() => tableId && setSelectedContext({ type: "field", fieldId: field.id, tableId })}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div className="pt-4 border-t space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Show Field Labels</Label>
            <p className="text-xs text-gray-500">Display field names in the left column</p>
          </div>
          <Checkbox
            checked={showLabels}
            onCheckedChange={handleShowLabelsChange}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Compact Mode</Label>
            <p className="text-xs text-gray-500">Use more compact spacing</p>
          </div>
          <Checkbox
            checked={compact}
            onCheckedChange={handleCompactChange}
          />
        </div>
      </div>

    </div>
  )
}

// Sortable field item component
function SortableFieldItem({
  field,
  isVisible,
  onToggle,
  onConfigure,
}: {
  field: TableField
  isVisible: boolean
  onToggle: () => void
  onConfigure: () => void
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
      className={`flex items-center gap-3 p-2 border rounded-md bg-white ${
        !isVisible ? "opacity-50" : ""
      }`}
    >
      <div {...attributes} {...listeners} className="cursor-grab">
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>
      
      <Checkbox
        checked={isVisible}
        onCheckedChange={onToggle}
        className="flex-shrink-0"
      />
      
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">
          {field.name}
        </div>
        <div className="text-xs text-gray-500">{field.type}</div>
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onConfigure()
        }}
        className="h-7 px-2 text-xs"
        title="Configure field"
      >
        <Settings className="h-3.5 w-3.5" />
      </Button>
      
      {isVisible ? (
        <Eye className="h-4 w-4 text-gray-400" />
      ) : (
        <EyeOff className="h-4 w-4 text-gray-300" />
      )}
    </div>
  )
}
