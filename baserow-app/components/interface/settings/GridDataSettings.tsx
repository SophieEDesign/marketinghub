"use client"

import { useState, useEffect, useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Grid, Columns, Calendar, Image as ImageIcon, GitBranch, X, Plus, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import type { BlockConfig, ViewType, BlockFilter } from "@/lib/interface/types"
import type { Table, View, TableField } from "@/types/database"
import type { FieldType } from "@/types/fields"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import BlockFilterEditor from "./BlockFilterEditor"

interface GridDataSettingsProps {
  config: BlockConfig
  tables: Table[]
  views: View[]
  fields: TableField[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
}

interface ViewTypeOption {
  type: ViewType
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  requiredFields: FieldType[] // Field types required for this view
}

// Show Table, Calendar, Kanban, and Timeline view types
const VIEW_TYPE_OPTIONS: ViewTypeOption[] = [
  {
    type: 'grid',
    label: 'Table',
    icon: Grid,
    description: 'Spreadsheet-style table view',
    requiredFields: [],
  },
  {
    type: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    description: 'Month/week calendar view',
    requiredFields: ['date'] as FieldType[],
  },
  {
    type: 'kanban',
    label: 'Kanban',
    icon: Columns,
    description: 'Board view with columns',
    requiredFields: [],
  },
  {
    type: 'timeline',
    label: 'Timeline',
    icon: GitBranch,
    description: 'Chronological timeline view',
    requiredFields: ['date'] as FieldType[],
  },
  {
    type: 'gallery',
    label: 'Gallery',
    icon: ImageIcon,
    description: 'Card-based visual layout',
    requiredFields: [],
  },
]

export default function GridDataSettings({
  config,
  tables,
  views,
  fields,
  onUpdate,
  onTableChange,
}: GridDataSettingsProps) {
  // Removed SQL view loading - users select tables, not SQL views
  // SQL views are internal and must never be selected by users

  const [addFieldValue, setAddFieldValue] = useState<string>('')
  const [addModalFieldValue, setAddModalFieldValue] = useState<string>('')

  // Determine compatible view types based on available fields
  const getCompatibleViewTypes = (): ViewType[] => {
    const fieldTypes = new Set<FieldType>(fields.map(f => f.type as FieldType))
    
    return VIEW_TYPE_OPTIONS.filter(option => {
      if (option.requiredFields.length === 0) return true
      return option.requiredFields.some(type => fieldTypes.has(type as FieldType))
    }).map(option => option.type)
  }

  const compatibleTypes = getCompatibleViewTypes()
  const currentViewType: ViewType = config?.view_type || 'grid'

  // Get available fields for display (exclude system fields)
  const availableDisplayFields = useMemo(() => {
    return fields.filter((f) => f.name !== 'id' && f.name !== 'created_at' && f.name !== 'updated_at')
  }, [fields])

  // Get currently selected display fields in order
  const selectedDisplayFields = useMemo(() => {
    const selectedFieldNames = config.visible_fields || []
    return selectedFieldNames
      .map((fieldName: string) => availableDisplayFields.find((f: TableField) => f.name === fieldName || f.id === fieldName))
      .filter((f: TableField | undefined): f is TableField => f !== undefined)
  }, [config.visible_fields, availableDisplayFields])

  // Get currently selected modal fields in order
  const selectedModalFields = useMemo(() => {
    const selectedFieldNames = (config as any).modal_fields || []
    return selectedFieldNames
      .map((fieldName: string) => availableDisplayFields.find((f: TableField) => f.name === fieldName || f.id === fieldName))
      .filter((f: TableField | undefined): f is TableField => f !== undefined)
  }, [(config as any).modal_fields, availableDisplayFields])

  // Get fields that can be added to display (not already selected)
  const availableToAdd = useMemo(() => {
    const selectedNames = config.visible_fields || []
    return availableDisplayFields.filter((f) => !selectedNames.includes(f.name) && !selectedNames.includes(f.id))
  }, [availableDisplayFields, config.visible_fields])

  // Get fields that can be added to modal (not already selected)
  const availableToAddModal = useMemo(() => {
    const selectedNames = (config as any).modal_fields || []
    return availableDisplayFields.filter((f) => !selectedNames.includes(f.name) && !selectedNames.includes(f.id))
  }, [availableDisplayFields, (config as any).modal_fields])

  // Set up drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end for display fields (reorder fields)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const currentFields = config.visible_fields || []
    const oldIndex = currentFields.indexOf(active.id as string)
    const newIndex = currentFields.indexOf(over.id as string)

    if (oldIndex !== -1 && newIndex !== -1) {
      const newFields = arrayMove(currentFields, oldIndex, newIndex)
      onUpdate({ visible_fields: newFields })
    }
  }

  // Handle drag end for modal fields (reorder fields)
  const handleModalDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const currentFields = (config as any).modal_fields || []
    const oldIndex = currentFields.indexOf(active.id as string)
    const newIndex = currentFields.indexOf(over.id as string)

    if (oldIndex !== -1 && newIndex !== -1) {
      const newFields = arrayMove(currentFields, oldIndex, newIndex)
      onUpdate({ modal_fields: newFields } as any)
    }
  }

  // Handle adding a field to display
  const handleAddField = (fieldName: string) => {
    const currentFields = config.visible_fields || []
    const field = fields.find(f => f.name === fieldName || f.id === fieldName)
    if (field && !currentFields.includes(field.name) && !currentFields.includes(field.id)) {
      onUpdate({ visible_fields: [...currentFields, field.name] })
      setAddFieldValue('')
    }
  }

  // Handle removing a field from display
  const handleRemoveField = (fieldName: string) => {
    const currentFields = config.visible_fields || []
    onUpdate({
      visible_fields: currentFields.filter((f: string) => f !== fieldName && f !== fieldName)
    })
  }

  // Handle adding a field to modal
  const handleAddModalField = (fieldName: string) => {
    const currentFields = (config as any).modal_fields || []
    const field = fields.find(f => f.name === fieldName || f.id === fieldName)
    if (field && !currentFields.includes(field.name) && !currentFields.includes(field.id)) {
      onUpdate({ modal_fields: [...currentFields, field.name] } as any)
      setAddModalFieldValue('')
    }
  }

  // Handle removing a field from modal
  const handleRemoveModalField = (fieldName: string) => {
    const currentFields = (config as any).modal_fields || []
    onUpdate({
      modal_fields: currentFields.filter((f: string) => f !== fieldName)
    } as any)
  }

  return (
    <div className="space-y-4">
      {/* Table Selection - Users select tables, not SQL views */}
      <div className="space-y-2">
        <Label>Table *</Label>
        <Select
          value={config.table_id || ""}
          onValueChange={onTableChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a table" />
          </SelectTrigger>
          <SelectContent>
            {tables.map((table) => (
              <SelectItem key={table.id} value={table.id}>
                {table.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          Table blocks require a table connection. Select a table to configure visible fields.
        </p>
      </div>

      {/* View Selection (optional) - Only for Table view, not Calendar */}
      {currentViewType === 'grid' && config.table_id && views.length > 0 && (
        <div className="space-y-2">
          <Label>View (optional)</Label>
          <Select
            value={config.view_id || "__all__"}
            onValueChange={(value) => onUpdate({ view_id: value === "__all__" ? undefined : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All records" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All records</SelectItem>
              {views.map((view) => (
                <SelectItem key={view.id} value={view.id}>
                  {view.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* View Type Selection - Card Style */}
      <div className="space-y-2">
        <Label>View Type *</Label>
        <div className="grid grid-cols-2 gap-2">
          {VIEW_TYPE_OPTIONS.map((option) => {
            const Icon = option.icon
            const isCompatible = compatibleTypes.includes(option.type)
            const isSelected = currentViewType === option.type

            return (
              <button
                key={option.type}
                type="button"
                onClick={() => isCompatible && onUpdate({ view_type: option.type })}
                disabled={!isCompatible}
                className={`
                  p-3 border rounded-lg text-left transition-all
                  ${isSelected 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                  }
                  ${!isCompatible 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'cursor-pointer hover:bg-gray-50'
                  }
                `}
              >
                <div className="flex items-start gap-2">
                  <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{option.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {option.description}
                    </div>
                    {!isCompatible && (
                      <div className="text-xs text-amber-600 mt-1">
                        Requires date fields
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-gray-500">
          Table, Calendar, Kanban, and Timeline views are supported.
        </p>
      </div>

      {/* Fields to Show on Cards/Table - Required */}
      {config.table_id && fields.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label>Fields to Show on Cards/Table *</Label>
              <p className="text-xs text-gray-500 mt-0.5">
                Choose which fields appear in the view. Drag to reorder.
              </p>
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
                {availableToAdd.map((field) => (
                  <SelectItem key={field.id} value={field.name}>
                    {field.name} ({field.type})
                  </SelectItem>
                ))}
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
              items={selectedDisplayFields.map((f: TableField) => f.name)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 max-h-[200px] overflow-y-auto border border-gray-200 rounded-md p-2">
                {selectedDisplayFields.length > 0 ? (
                  selectedDisplayFields.map((field: TableField) => (
                    <SortableFieldItem
                      key={field.id}
                      field={field}
                      onRemove={() => handleRemoveField(field.name)}
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
          <p className="text-xs text-gray-500">
            At least one field must be selected.
          </p>
        </div>
      )}

      {/* Fields to Show in Modal */}
      {config.table_id && fields.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <Label>Fields to Show in Modal</Label>
              <p className="text-xs text-gray-500 mt-0.5">
                Choose which fields appear when clicking on a record. Drag to reorder. Leave empty to show all fields.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  // Select all fields
                  const allFieldNames = availableDisplayFields.map(f => f.name)
                  onUpdate({ modal_fields: allFieldNames } as any)
                }}
                className="text-xs text-blue-600 hover:text-blue-700 underline"
              >
                Select All
              </button>
              <span className="text-xs text-gray-300">|</span>
              <button
                type="button"
                onClick={() => {
                  // Select none
                  onUpdate({ modal_fields: [] } as any)
                }}
                className="text-xs text-blue-600 hover:text-blue-700 underline"
              >
                Select None
              </button>
            </div>
          </div>

          {/* Add Field Dropdown */}
          {availableToAddModal.length > 0 && (
            <Select
              value={addModalFieldValue}
              onValueChange={(value) => {
                if (value) {
                  handleAddModalField(value)
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Add a field..." />
              </SelectTrigger>
              <SelectContent>
                {availableToAddModal.map((field) => (
                  <SelectItem key={field.id} value={field.name}>
                    {field.name} ({field.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Selected Fields List with Drag and Drop */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleModalDragEnd}
          >
            <SortableContext
              items={selectedModalFields.map((f: TableField) => f.name)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 max-h-[200px] overflow-y-auto border border-gray-200 rounded-md p-2">
                {selectedModalFields.length > 0 ? (
                  selectedModalFields.map((field: TableField) => (
                    <SortableFieldItem
                      key={field.id}
                      field={field}
                      onRemove={() => handleRemoveModalField(field.name)}
                    />
                  ))
                ) : (
                  <p className="text-xs text-gray-400 italic text-center py-4">
                    No fields selected. All fields will be shown in the modal. Add fields using the dropdown above to limit what&apos;s displayed.
                  </p>
                )}
              </div>
            </SortableContext>
          </DndContext>

          {availableDisplayFields.length === 0 && (
            <p className="text-xs text-gray-400 italic">No fields available to display</p>
          )}
        </div>
      )}

      {/* Filters (optional) - For Table, Calendar, Kanban, and Timeline views */}
      {(currentViewType === 'grid' || currentViewType === 'calendar' || currentViewType === 'kanban' || currentViewType === 'timeline') && config.table_id && fields.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <BlockFilterEditor
            filters={config.filters || []}
            tableFields={fields}
            onChange={(filters) => onUpdate({ filters })}
          />
        </div>
      )}

      {/* Sorts (optional) - Only for Table view */}
      {currentViewType === 'grid' && config.table_id && fields.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Sort (optional)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const currentSorts = Array.isArray(config.sorts) ? config.sorts : []
                // Only allow one sort for now
                if (currentSorts.length === 0) {
                  onUpdate({
                    sorts: [{ field: fields[0]?.name || '', direction: 'asc' }]
                  })
                }
              }}
              disabled={(Array.isArray(config.sorts) ? config.sorts : []).length > 0}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Sort
            </Button>
          </div>
          <div className="space-y-2">
            {(Array.isArray(config.sorts) ? config.sorts : []).slice(0, 1).map((sort: any, index: number) => (
              <div key={index} className="flex gap-2 items-center p-2 border rounded-md">
                <Select
                  value={sort.field || ''}
                  onValueChange={(value) => {
                    const currentSorts = Array.isArray(config.sorts) ? config.sorts : []
                    const updated = [...currentSorts]
                    updated[index] = { ...updated[index], field: value }
                    onUpdate({ sorts: updated })
                  }}
                >
                  <SelectTrigger className="h-8 flex-1">
                    <SelectValue placeholder="Field" />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={sort.direction || 'asc'}
                  onValueChange={(value) => {
                    const currentSorts = Array.isArray(config.sorts) ? config.sorts : []
                    const updated = [...currentSorts]
                    updated[index] = { ...updated[index], direction: value as 'asc' | 'desc' }
                    onUpdate({ sorts: updated })
                  }}
                >
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onUpdate({ sorts: [] })
                  }}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {(!Array.isArray(config.sorts) || config.sorts.length === 0) && (
              <p className="text-xs text-gray-400 italic">No sort configured</p>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Sort rows by a single field in ascending or descending order.
          </p>
        </div>
      )}

      {/* Calendar-Specific Settings - Airtable Style */}
      {currentViewType === 'calendar' && config.table_id && fields.length > 0 && (
        <>
          {/* Options Section - Airtable Style */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <Label className="text-sm font-semibold">Options</Label>
            
            {/* Date Settings */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Date settings</Label>
              <Select
                value={config.start_date_field || config.calendar_date_field || config.from_date_field || ""}
                onValueChange={(value) => onUpdate({ start_date_field: value, from_date_field: value, calendar_date_field: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select a date field" />
                </SelectTrigger>
                <SelectContent>
                  {fields
                    .filter(field => field.type === 'date')
                    .map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {fields.filter(f => f.type === 'date').length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No date fields found. Please add a date field to the table.
                </p>
              )}
            </div>

            {/* End Date Field (optional) */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">End date (optional)</Label>
              <Select
                value={config.end_date_field || config.to_date_field || "__none__"}
                onValueChange={(value) => onUpdate({ end_date_field: value === "__none__" ? undefined : value, to_date_field: value === "__none__" ? undefined : value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select end date field (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (single date events)</SelectItem>
                  {fields
                    .filter(field => field.type === 'date')
                    .map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Sort</Label>
              <Select
                value={(Array.isArray(config.sorts) && config.sorts.length > 0) ? config.sorts[0].field + ':' + config.sorts[0].direction : "__none__"}
                onValueChange={(value) => {
                  if (value === "__none__") {
                    onUpdate({ sorts: [] })
                  } else {
                    const [field, direction] = value.split(':')
                    onUpdate({ sorts: [{ field, direction: direction as 'asc' | 'desc' }] })
                  }
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {fields.flatMap((field) => [
                  <SelectItem key={`${field.id}-asc`} value={`${field.name}:asc`}>
                    {field.name} (Ascending)
                  </SelectItem>,
                  <SelectItem key={`${field.id}-desc`} value={`${field.name}:desc`}>
                    {field.name} (Descending)
                  </SelectItem>
                ])}
              </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fields Section - Airtable Style */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Fields</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allFieldNames = fields.map(f => f.name)
                    onUpdate({ visible_fields: allFieldNames })
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Select All
                </button>
                <span className="text-xs text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => {
                    onUpdate({ visible_fields: [] })
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Select None
                </button>
              </div>
            </div>
            <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2 bg-gray-50">
              {fields.map((field) => {
                const visibleFields = config.visible_fields || []
                const isVisible = visibleFields.includes(field.name) || visibleFields.includes(field.id)
                return (
                  <label
                    key={field.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded transition-colors"
                  >
                    <Checkbox
                      checked={isVisible}
                      onCheckedChange={(checked) => {
                        const currentFields = config.visible_fields || []
                        if (checked) {
                          if (!currentFields.includes(field.name) && !currentFields.includes(field.id)) {
                            onUpdate({ visible_fields: [...currentFields, field.name] })
                          }
                        } else {
                          onUpdate({
                            visible_fields: currentFields.filter(
                              (f: string) => f !== field.name && f !== field.id
                            ),
                          })
                        }
                      }}
                    />
                    <span className="text-sm flex-1">{field.name}</span>
                    <span className="text-xs text-gray-400 capitalize">{field.type.replace('_', ' ')}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Kanban-Specific Settings - Airtable Style */}
      {currentViewType === 'kanban' && config.table_id && fields.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-gray-200">
          <Label className="text-sm font-semibold">Options</Label>
          
          {/* Grouping Field Settings */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700">Group by *</Label>
            <Select
              value={config.group_by_field || config.group_by || config.kanban_group_field || ""}
              onValueChange={(value) => onUpdate({ group_by_field: value, group_by: value, kanban_group_field: value })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select a select field" />
              </SelectTrigger>
              <SelectContent>
                {fields
                  .filter(field => field.type === 'single_select' || field.type === 'multi_select')
                  .map((field) => (
                    <SelectItem key={field.id} value={field.name}>
                      {field.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {fields.filter(f => f.type === 'single_select' || f.type === 'multi_select').length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No select fields found. Please add a single-select or multi-select field to the table.
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Select a single-select or multi-select field to group cards into columns.
            </p>
          </div>
        </div>
      )}

      {/* Timeline-Specific Settings - Airtable Style */}
      {currentViewType === 'timeline' && config.table_id && fields.length > 0 && (
        <>
          {/* Options Section - Airtable Style */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <Label className="text-sm font-semibold">Options</Label>
            
            {/* Date Settings */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Date settings</Label>
              <Select
                value={config.start_date_field || config.date_from || config.from_date_field || config.timeline_date_field || ""}
                onValueChange={(value) => onUpdate({ 
                  start_date_field: value, 
                  date_from: value, 
                  from_date_field: value,
                  timeline_date_field: value 
                })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select a date field" />
                </SelectTrigger>
                <SelectContent>
                  {fields
                    .filter(field => field.type === 'date')
                    .map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {fields.filter(f => f.type === 'date').length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No date fields found. Please add a date field to the table.
                </p>
              )}
            </div>

            {/* End Date Field (optional) */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">End date (optional)</Label>
              <Select
                value={config.end_date_field || config.date_to || config.to_date_field || "__none__"}
                onValueChange={(value) => onUpdate({ 
                  end_date_field: value === "__none__" ? undefined : value, 
                  date_to: value === "__none__" ? undefined : value,
                  to_date_field: value === "__none__" ? undefined : value 
                })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select end date field (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (single date events)</SelectItem>
                  {fields
                    .filter(field => field.type === 'date')
                    .map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Use start + end fields for date range events, or leave as &quot;None&quot; for single date events.
              </p>
            </div>

            {/* Group by Select Field */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Group by (optional)</Label>
              <Select
                value={config.timeline_group_by || config.group_by_field || config.group_by || "__none__"}
                onValueChange={(value) => onUpdate({ 
                  timeline_group_by: value === "__none__" ? undefined : value,
                  group_by_field: value === "__none__" ? undefined : value,
                  group_by: value === "__none__" ? undefined : value
                })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select a select field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (no grouping)</SelectItem>
                  {fields
                    .filter(field => field.type === 'single_select' || field.type === 'multi_select')
                    .map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {fields.filter(f => f.type === 'single_select' || f.type === 'multi_select').length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No select fields found. Add a single-select or multi-select field to enable grouping.
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Group timeline events by a select field. Each group appears as a separate lane.
              </p>
            </div>
          </div>

          {/* Card Fields Section - Airtable Style */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <Label className="text-sm font-semibold">Card fields</Label>
            <p className="text-xs text-gray-500 mb-3">
              Configure which fields appear on timeline cards
            </p>

            {/* Title Field */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Title field</Label>
              <Select
                value={config.timeline_title_field || config.card_title_field || ""}
                onValueChange={(value) => onUpdate({ 
                  timeline_title_field: value,
                  card_title_field: value
                })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select title field (default: primary field)" />
                </SelectTrigger>
                <SelectContent>
                  {fields
                    .filter(field => field.type !== 'date' && field.type !== 'formula' && field.type !== 'lookup')
                    .map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Field to use as the card title. Defaults to the primary field if not set.
              </p>
            </div>

            {/* Secondary Fields */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Field 1 (optional)</Label>
              <Select
                value={config.timeline_field_1 || config.card_field_1 || "__none__"}
                onValueChange={(value) => onUpdate({ 
                  timeline_field_1: value === "__none__" ? undefined : value,
                  card_field_1: value === "__none__" ? undefined : value
                })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {fields
                    .filter(field => field.type !== 'date' && field.type !== 'formula' && field.type !== 'lookup')
                    .map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Field 2 (optional)</Label>
              <Select
                value={config.timeline_field_2 || config.card_field_2 || "__none__"}
                onValueChange={(value) => onUpdate({ 
                  timeline_field_2: value === "__none__" ? undefined : value,
                  card_field_2: value === "__none__" ? undefined : value
                })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {fields
                    .filter(field => field.type !== 'date' && field.type !== 'formula' && field.type !== 'lookup')
                    .map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Field 3 (optional)</Label>
              <Select
                value={config.timeline_field_3 || config.card_field_3 || "__none__"}
                onValueChange={(value) => onUpdate({ 
                  timeline_field_3: value === "__none__" ? undefined : value,
                  card_field_3: value === "__none__" ? undefined : value
                })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {fields
                    .filter(field => field.type !== 'date' && field.type !== 'formula' && field.type !== 'lookup')
                    .map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fields Section - Airtable Style */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Fields</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allFieldNames = fields.map(f => f.name)
                    onUpdate({ visible_fields: allFieldNames })
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Select All
                </button>
                <span className="text-xs text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => {
                    onUpdate({ visible_fields: [] })
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Select None
                </button>
              </div>
            </div>
            <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2 bg-gray-50">
              {fields.map((field) => {
                const visibleFields = config.visible_fields || []
                const isVisible = visibleFields.includes(field.name) || visibleFields.includes(field.id)
                return (
                  <label
                    key={field.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded transition-colors"
                  >
                    <Checkbox
                      checked={isVisible}
                      onCheckedChange={(checked) => {
                        const currentFields = config.visible_fields || []
                        if (checked) {
                          if (!currentFields.includes(field.name) && !currentFields.includes(field.id)) {
                            onUpdate({ visible_fields: [...currentFields, field.name] })
                          }
                        } else {
                          onUpdate({
                            visible_fields: currentFields.filter(
                              (f: string) => f !== field.name && f !== field.id
                            ),
                          })
                        }
                      }}
                    />
                    <span className="text-sm flex-1">{field.name}</span>
                    <span className="text-xs text-gray-400 capitalize">{field.type.replace('_', ' ')}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Sortable field item component
function SortableFieldItem({
  field,
  onRemove,
}: {
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
  } = useSortable({ id: field.name })

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
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>
      
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
          onRemove()
        }}
        className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
        title="Remove field"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

