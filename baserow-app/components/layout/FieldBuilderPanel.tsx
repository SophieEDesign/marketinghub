"use client"

import { useState, useEffect, memo, useMemo } from "react"
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
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Plus, Edit, Trash2, Save, X, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TableField, FieldType, FieldOptions } from "@/types/fields"
import { FIELD_TYPES } from "@/types/fields"
import FormulaEditor from "@/components/fields/FormulaEditor"
import FieldSettingsDrawer from "./FieldSettingsDrawer"

interface FieldBuilderPanelProps {
  tableId: string
  supabaseTableName: string
  onFieldsUpdated: () => void
}

const FieldBuilderPanel = memo(function FieldBuilderPanel({
  tableId,
  supabaseTableName,
  onFieldsUpdated,
}: FieldBuilderPanelProps) {
  const [fields, setFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(true)
  const [editingField, setEditingField] = useState<TableField | null>(null)
  const [showNewField, setShowNewField] = useState(false)
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false)

  useEffect(() => {
    loadFields()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId])

  async function loadFields() {
    try {
      // Bypass any intermediate caching so the UI reflects settings changes immediately.
      const response = await fetch(`/api/tables/${tableId}/fields`, { cache: "no-store" })
      const data = await response.json()
      if (data.fields) {
        // Sort by order_index, then by position, then by name
        const sortedFields = [...data.fields].sort((a, b) => {
          const aOrder = a.order_index ?? a.position ?? 0
          const bOrder = b.order_index ?? b.position ?? 0
          if (aOrder !== bOrder) return aOrder - bOrder
          return a.name.localeCompare(b.name)
        })
        setFields(sortedFields)
      }
    } catch (error) {
      console.error("Error loading fields:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleReorderFields(newOrder: TableField[]) {
    try {
      // Update order_index for all fields
      const updates = newOrder.map((field, index) => ({
        id: field.id,
        order_index: index,
      }))

      const response = await fetch(`/api/tables/${tableId}/fields/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || "Failed to reorder fields")
        await loadFields() // Revert on error
        return
      }

      setFields(newOrder)
      onFieldsUpdated()
    } catch (error) {
      console.error("Error reordering fields:", error)
      alert("Failed to reorder fields")
      await loadFields() // Revert on error
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id)
      const newIndex = fields.findIndex((f) => f.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(fields, oldIndex, newIndex)
        handleReorderFields(newOrder)
      }
    }
  }

  // Group fields by group_name
  const groupedFields = useMemo(() => {
    const groups: Record<string, TableField[]> = {}
    const ungrouped: TableField[] = []

    fields.forEach((field) => {
      const group = field.group_name || null
      if (group) {
        if (!groups[group]) {
          groups[group] = []
        }
        groups[group].push(field)
      } else {
        ungrouped.push(field)
      }
    })

    return { groups, ungrouped }
  }, [fields])

  async function handleCreateField(fieldData: Partial<TableField>) {
    try {
      const response = await fetch(`/api/tables/${tableId}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fieldData),
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || "Failed to create field")
        return
      }

      await loadFields()
      onFieldsUpdated()
      setShowNewField(false)
    } catch (error) {
      console.error("Error creating field:", error)
      alert("Failed to create field")
    }
  }

  async function handleUpdateField(fieldId: string, updates: Partial<TableField>) {
    try {
      const response = await fetch(`/api/tables/${tableId}/fields`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldId,
          ...updates,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || "Failed to update field")
        return
      }

      await loadFields()
      onFieldsUpdated()
      setEditingField(null)
    } catch (error) {
      console.error("Error updating field:", error)
      alert("Failed to update field")
    }
  }

  async function handleDeleteField(fieldId: string, fieldName: string) {
    if (!confirm(`Are you sure you want to delete the field "${fieldName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/tables/${tableId}/fields?fieldId=${fieldId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || "Failed to delete field")
        return
      }

      await loadFields()
      onFieldsUpdated()
    } catch (error) {
      console.error("Error deleting field:", error)
      alert("Failed to delete field")
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading fields...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Fields</h3>
        <Button
          size="sm"
          onClick={() => setShowNewField(true)}
          className="h-8 px-3 text-sm"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New Field
        </Button>
      </div>

      {showNewField && (
        <NewFieldForm
          onSave={handleCreateField}
          onCancel={() => setShowNewField(false)}
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={fields.map((f) => f.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {/* Ungrouped fields */}
            {groupedFields.ungrouped.length > 0 && (
              <div className="space-y-2">
                {groupedFields.ungrouped.map((field) => (
                  <SortableFieldItem
                    key={field.id}
                    field={field}
                    onEdit={() => {
                      setEditingField(field)
                      setSettingsDrawerOpen(true)
                    }}
                    onDelete={() => handleDeleteField(field.id, field.name)}
                  />
                ))}
              </div>
            )}

            {/* Grouped fields */}
            {Object.entries(groupedFields.groups).map(([groupName, groupFields]) => (
              <div key={groupName} className="space-y-2">
                <div className="px-2 py-1 text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 rounded">
                  {groupName}
                </div>
                {groupFields.map((field) => (
                  <SortableFieldItem
                    key={field.id}
                    field={field}
                    onEdit={() => {
                      setEditingField(field)
                      setSettingsDrawerOpen(true)
                    }}
                    onDelete={() => handleDeleteField(field.id, field.name)}
                  />
                ))}
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <FieldSettingsDrawer
        field={editingField}
        open={settingsDrawerOpen}
        onOpenChange={(open) => {
          setSettingsDrawerOpen(open)
          if (!open) {
            setEditingField(null)
          }
        }}
        tableId={tableId}
        tableFields={fields}
        onSave={async () => {
          await loadFields()
          onFieldsUpdated()
        }}
      />
    </div>
  )
})

function NewFieldForm({
  onSave,
  onCancel,
}: {
  onSave: (fieldData: Partial<TableField>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState("")
  const [type, setType] = useState<FieldType>("text")
  const [required, setRequired] = useState(false)
  const [options, setOptions] = useState<FieldOptions>({})

  const fieldTypeInfo = FIELD_TYPES.find(t => t.type === type)
  const isVirtual = fieldTypeInfo?.isVirtual || false

  function handleSubmit() {
    if (!name.trim()) {
      alert("Field name is required")
      return
    }

    onSave({
      name: name.trim(),
      type,
      required,
      options: Object.keys(options).length > 0 ? options : undefined,
    })
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
      <div>
        <Label className="text-xs font-medium text-gray-700">Field Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter field name"
          className="mt-1 h-8 text-sm"
        />
      </div>

      <div>
        <Label className="text-xs font-medium text-gray-700">Field Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
          <SelectTrigger className="mt-1 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((ft) => (
              <SelectItem key={ft.type} value={ft.type}>
                {ft.label} {ft.isVirtual ? "(Virtual)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isVirtual && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="new-required"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="w-4 h-4"
          />
          <Label htmlFor="new-required" className="text-xs text-gray-700">
            Required
          </Label>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="flex-1 h-8 text-sm"
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          Create
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          className="h-8 text-sm"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function SortableFieldItem({
  field,
  onEdit,
  onDelete,
}: {
  field: TableField
  onEdit: () => void
  onDelete: () => void
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

  const fieldTypeInfo = FIELD_TYPES.find(t => t.type === field.type)
  const isVirtual = fieldTypeInfo?.isVirtual || false

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 mt-0.5"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">
              {field.name}
            </span>
            {field.required && (
              <span className="text-xs text-red-600">*</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {FIELD_TYPES.find(t => t.type === field.type)?.label || field.type}
            </span>
            {isVirtual && (
              <span className="text-xs text-blue-600">(Virtual)</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onEdit}
            className="h-7 w-7 p-0"
          >
            <Edit className="h-3.5 w-3.5 text-gray-500" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default FieldBuilderPanel
