"use client"

import { useState, useMemo } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { X, GripVertical, Plus } from "lucide-react"
import type { TableField } from "@/types/database"
import { getFieldDisplayName } from "@/lib/fields/display"
import { sectionAndSortFields } from "@/lib/fields/sectioning"
import { SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select"

interface CardFieldsSelectorProps {
  value: string[]
  onChange: (fieldNames: string[]) => void
  fields: TableField[]
  label?: string
  description?: string
  required?: boolean
}

function SortableFieldItem({
  id,
  field,
  onRemove,
}: {
  id: string
  field: TableField
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-2 border rounded-md bg-white hover:bg-gray-50"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 text-sm">{getFieldDisplayName(field)}</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-gray-400 hover:text-gray-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function CardFieldsSelector({
  value,
  onChange,
  fields,
  label = "Fields to Show on Cards/Table",
  description,
  required = true,
}: CardFieldsSelectorProps) {
  const [addFieldValue, setAddFieldValue] = useState<string>("")

  // Filter out id field
  const availableDisplayFields = useMemo(() => {
    return fields.filter((f) => f.name !== "id")
  }, [fields])

  // Get currently selected fields in order
  const selectedFields = useMemo<Array<{ key: string; field: TableField }>>(() => {
    const selectedKeys: string[] = Array.isArray(value) ? value : []
    return selectedKeys
      .map((key: string) => {
        const field = availableDisplayFields.find(
          (f: TableField) => f.name === key || f.id === key
        )
        return field ? { key, field } : null
      })
      .filter((item): item is { key: string; field: TableField } => item !== null)
  }, [value, availableDisplayFields])

  // Get fields that can be added (not already selected)
  const availableToAdd = useMemo(() => {
    const selectedNames = value || []
    return availableDisplayFields.filter(
      (f) => !selectedNames.includes(f.name) && !selectedNames.includes(f.id)
    )
  }, [availableDisplayFields, value])

  // Section fields by group_name for dropdown
  const sectionedAvailableFields = useMemo(() => {
    return sectionAndSortFields(availableToAdd)
  }, [availableToAdd])

  // Handle adding all fields from a section
  const handleAddAllFromSection = (sectionFields: TableField[]) => {
    const currentFields = value || []
    const newFields = sectionFields
      .filter((field) => {
        return !currentFields.includes(field.name) && !currentFields.includes(field.id)
      })
      .map((field) => field.name)
    
    if (newFields.length > 0) {
      onChange([...currentFields, ...newFields])
      setAddFieldValue("")
    }
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

    const currentFields = value || []
    const oldIndex = currentFields.indexOf(active.id as string)
    const newIndex = currentFields.indexOf(over.id as string)

    if (oldIndex !== -1 && newIndex !== -1) {
      const newFields = arrayMove(currentFields, oldIndex, newIndex)
      onChange(newFields)
    }
  }

  // Handle adding a field
  const handleAddField = (fieldName: string) => {
    const currentFields = value || []
    const field = fields.find((f) => f.name === fieldName || f.id === fieldName)
    if (field && !currentFields.includes(field.name) && !currentFields.includes(field.id)) {
      onChange([...currentFields, field.name])
      setAddFieldValue("")
    }
  }

  // Handle removing a field
  const handleRemoveField = (fieldKey: string) => {
    const currentFields = value || []
    const field = fields.find((f) => f.name === fieldKey || f.id === fieldKey)
    const keysToRemove = new Set<string>([fieldKey])
    if (field) {
      keysToRemove.add(field.name)
      keysToRemove.add(field.id)
    }
    onChange(currentFields.filter((f: string) => !keysToRemove.has(f)))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Label>
            {label} {required && <span className="text-red-500">*</span>}
          </Label>
          {description ? (
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          ) : (
            <p className="text-xs text-gray-500 mt-0.5">
              Choose which fields appear in the view. Drag to reorder.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const allFieldNames = availableDisplayFields.map((f) => f.name)
              onChange(allFieldNames)
            }}
            className="text-xs text-blue-600 hover:text-blue-700 underline"
          >
            Select All
          </button>
          <span className="text-xs text-gray-300">|</span>
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-blue-600 hover:text-blue-700 underline"
          >
            Select None
          </button>
        </div>
      </div>

      {/* Add Field Dropdown */}
      {availableToAdd.length > 0 && (
        <Select
          value={addFieldValue}
          onValueChange={(value) => {
            if (value) {
              handleAddField(value)
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Add a field..." />
          </SelectTrigger>
          <SelectContent>
            {sectionedAvailableFields && sectionedAvailableFields.length > 0 ? (
              sectionedAvailableFields.map(([sectionName, sectionFields]: [string, TableField[]], sectionIndex: number) => (
                <SelectGroup key={sectionName}>
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <SelectLabel className="text-xs font-semibold text-gray-700">
                      {sectionName}
                    </SelectLabel>
                    {sectionFields.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddAllFromSection(sectionFields)
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1"
                        title={`Add all ${sectionFields.length} fields from ${sectionName}`}
                      >
                        <Plus className="h-3 w-3" />
                        Add All
                      </button>
                    )}
                  </div>
                  {sectionFields.map((field: TableField) => (
                    <SelectItem key={field.id} value={field.name}>
                      {getFieldDisplayName(field)} ({field.type})
                    </SelectItem>
                  ))}
                  {sectionIndex < sectionedAvailableFields.length - 1 && (
                    <SelectSeparator />
                  )}
                </SelectGroup>
              ))
            ) : (
              availableToAdd.map((field) => (
                <SelectItem key={field.id} value={field.name}>
                  {getFieldDisplayName(field)} ({field.type})
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      )}

      {/* Selected Fields List with Drag and Drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={selectedFields.map((item) => item.key)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 max-h-[200px] overflow-y-auto border border-gray-200 rounded-md p-2">
            {selectedFields.length > 0 ? (
              selectedFields.map(({ field, key }) => (
                <SortableFieldItem
                  key={key}
                  id={key}
                  field={field}
                  onRemove={() => handleRemoveField(key)}
                />
              ))
            ) : (
              <p className="text-xs text-gray-400 italic text-center py-4">
                No fields selected. Add a field using the dropdown above.
              </p>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {availableDisplayFields.length === 0 && (
        <p className="text-xs text-gray-400 italic">No fields available to display</p>
      )}
      {required && (
        <p className="text-xs text-gray-500">At least one field must be selected.</p>
      )}
    </div>
  )
}
