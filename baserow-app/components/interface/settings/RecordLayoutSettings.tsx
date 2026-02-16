"use client"

import { useState, useCallback } from "react"
import { GripVertical, Eye, EyeOff } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
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
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { TableField } from "@/types/fields"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"
import {
  createInitialFieldLayout,
  getVisibleFieldsFromLayout,
} from "@/lib/interface/field-layout-helpers"
import { getFieldDisplayName } from "@/lib/fields/display"
import { cn } from "@/lib/utils"

interface RecordLayoutSettingsProps {
  tableId: string
  recordId: string
  fieldLayout: FieldLayoutItem[]
  onLayoutSave:
    | ((layout: FieldLayoutItem[]) => void)
    | ((layout: FieldLayoutItem[]) => Promise<void>)
    | null
  fields: TableField[]
}

function SortableFieldRow({
  item,
  field,
  onVisibilityToggle,
}: {
  item: FieldLayoutItem
  field: TableField
  onVisibilityToggle: (fieldName: string, visible: boolean) => void
}) {
  // Use visible_in_canvas (record_view inline panel); fallback to visible_in_modal for legacy layouts
  const visible = ((item as any).visible_in_canvas ?? (item as any).visible_in_modal) !== false
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.field_id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 py-2 px-3 rounded-md border border-gray-200 bg-white",
        !visible && "opacity-60",
        isDragging && "shadow-md z-10"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <span className="flex-1 text-sm font-medium truncate">
        {getFieldDisplayName(field)}
      </span>
      <button
        type="button"
        onClick={() => onVisibilityToggle(field.name, !visible)}
        className="p-1 text-gray-400 hover:text-gray-600"
        title={visible ? "Hide field" : "Show field"}
      >
        {visible ? (
          <Eye className="h-4 w-4" />
        ) : (
          <EyeOff className="h-4 w-4" />
        )}
      </button>
    </div>
  )
}

export default function RecordLayoutSettings({
  tableId,
  recordId,
  fieldLayout,
  onLayoutSave,
  fields,
}: RecordLayoutSettingsProps) {
  const resolvedLayout =
    fieldLayout.length > 0
      ? fieldLayout
      : createInitialFieldLayout(fields, "record_review", true)

  const [draftLayout, setDraftLayout] = useState<FieldLayoutItem[]>(() => [
    ...resolvedLayout,
  ])

  const visibleFields = getVisibleFieldsFromLayout(draftLayout, fields, "canvas")
  const fieldMap = new Map(fields.map((f) => [f.name, f]))

  const handleVisibilityToggle = useCallback((fieldName: string, visible: boolean) => {
    setDraftLayout((prev) => {
      const existing = prev.find(
        (i) => i.field_name === fieldName || i.field_id === fieldName
      )
      if (existing) {
        return prev.map((i) =>
          i.field_name === fieldName || i.field_id === fieldName
            ? {
                ...i,
                visible_in_canvas: visible,
                visible_in_modal: visible,
              }
            : i
        )
      }
      const field = fieldMap.get(fieldName)
      if (!field) return prev
      const newItem: FieldLayoutItem = {
        field_id: field.id,
        field_name: field.name,
        order: Math.max(...prev.map((i) => i.order), -1) + 1,
        editable: true,
        visible_in_canvas: visible,
        visible_in_modal: visible,
      }
      return [...prev, newItem]
    })
  }, [fieldMap])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setDraftLayout((prev) => {
      const ids = prev.map((i) => i.field_id)
      const oldIndex = ids.indexOf(active.id as string)
      const newIndex = ids.indexOf(over.id as string)
      if (oldIndex === -1 || newIndex === -1) return prev

      const reordered = [...prev]
      const [moved] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, moved)

      return reordered.map((item, index) => ({
        ...item,
        order: index,
      }))
    })
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleSave = useCallback(() => {
    if (onLayoutSave) {
      const result = onLayoutSave(draftLayout)
      if (result instanceof Promise) {
        result.catch((err) => console.error("Failed to save layout:", err))
      }
    }
  }, [draftLayout, onLayoutSave])

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">
          Field order and visibility
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Drag to reorder fields. Toggle visibility for each field in the record
          view.
        </p>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={draftLayout.map((i) => i.field_id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {draftLayout
                .sort((a, b) => a.order - b.order)
                .map((item) => {
                  const field =
                    fieldMap.get(item.field_name) ||
                    fields.find((f) => f.id === item.field_id)
                  if (!field) return null
                  return (
                    <SortableFieldRow
                      key={item.field_id}
                      item={item}
                      field={field}
                      onVisibilityToggle={handleVisibilityToggle}
                    />
                  )
                })}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {onLayoutSave && (
        <div className="pt-4 border-t">
          <Button onClick={handleSave} size="sm">
            Save layout
          </Button>
        </div>
      )}
    </div>
  )
}
