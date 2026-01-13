"use client"

import { useState, useEffect, useMemo } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { GripVertical, X } from 'lucide-react'
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
import type { TableField } from '@/types/fields'
import type { CalendarConfig } from './CalendarView'

interface CalendarSettingsProps {
  open: boolean
  onClose: () => void
  config: CalendarConfig
  tableFields: TableField[]
  onSave: (config: Partial<CalendarConfig>) => Promise<void>
}

export default function CalendarSettings({
  open,
  onClose,
  config,
  tableFields,
  onSave,
}: CalendarSettingsProps) {
  const [localConfig, setLocalConfig] = useState<CalendarConfig>(config)
  const [addFieldValue, setAddFieldValue] = useState<string>('')
  const [addModalFieldValue, setAddModalFieldValue] = useState<string>('')

  useEffect(() => {
    setLocalConfig(config)
  }, [config, open])

  const dateFields = tableFields.filter((f) => f.type === 'date')
  const selectFields = tableFields.filter((f) => f.type === 'single_select' || f.type === 'multi_select')

  // Get available fields for display on cards (exclude date and attachment fields)
  const availableDisplayFields = useMemo(() => {
    return tableFields.filter((f) => f.type !== 'date' && f.type !== 'attachment')
  }, [tableFields])

  // Get available fields for modal (all fields except system fields)
  const availableModalFields = useMemo(() => {
    return tableFields.filter((f) => f.name !== 'id' && f.name !== 'created_at' && f.name !== 'updated_at')
  }, [tableFields])

  // Get currently selected display fields in order (for cards)
  const selectedDisplayFields = useMemo(() => {
    const selectedFieldNames = localConfig.calendar_display_fields || []
    return selectedFieldNames
      .map((fieldName) => availableDisplayFields.find((f) => f.name === fieldName))
      .filter((f): f is TableField => f !== undefined)
  }, [localConfig.calendar_display_fields, availableDisplayFields])

  // Get currently selected modal fields in order
  const selectedModalFields = useMemo(() => {
    const selectedFieldNames = localConfig.calendar_modal_fields || []
    return selectedFieldNames
      .map((fieldName) => availableModalFields.find((f) => f.name === fieldName))
      .filter((f): f is TableField => f !== undefined)
  }, [localConfig.calendar_modal_fields, availableModalFields])

  // Get fields that can be added to cards (not already selected)
  const availableToAdd = useMemo(() => {
    const selectedNames = localConfig.calendar_display_fields || []
    return availableDisplayFields.filter((f) => !selectedNames.includes(f.name))
  }, [availableDisplayFields, localConfig.calendar_display_fields])

  // Get fields that can be added to modal (not already selected)
  const availableToAddModal = useMemo(() => {
    const selectedNames = localConfig.calendar_modal_fields || []
    return availableModalFields.filter((f) => !selectedNames.includes(f.name))
  }, [availableModalFields, localConfig.calendar_modal_fields])

  // Set up drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end for card fields (reorder fields)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const currentFields = localConfig.calendar_display_fields || []
    const oldIndex = currentFields.indexOf(active.id as string)
    const newIndex = currentFields.indexOf(over.id as string)

    if (oldIndex !== -1 && newIndex !== -1) {
      const newFields = arrayMove(currentFields, oldIndex, newIndex)
      setLocalConfig({
        ...localConfig,
        calendar_display_fields: newFields,
      })
    }
  }

  // Handle drag end for modal fields (reorder fields)
  const handleModalDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const currentFields = localConfig.calendar_modal_fields || []
    const oldIndex = currentFields.indexOf(active.id as string)
    const newIndex = currentFields.indexOf(over.id as string)

    if (oldIndex !== -1 && newIndex !== -1) {
      const newFields = arrayMove(currentFields, oldIndex, newIndex)
      setLocalConfig({
        ...localConfig,
        calendar_modal_fields: newFields,
      })
    }
  }

  // Handle adding a field to cards
  const handleAddField = (fieldName: string) => {
    const currentFields = localConfig.calendar_display_fields || []
    if (!currentFields.includes(fieldName)) {
      setLocalConfig({
        ...localConfig,
        calendar_display_fields: [...currentFields, fieldName],
      })
      // Reset the select dropdown
      setAddFieldValue('')
    }
  }

  // Handle removing a field from cards
  const handleRemoveField = (fieldName: string) => {
    const currentFields = localConfig.calendar_display_fields || []
    setLocalConfig({
      ...localConfig,
      calendar_display_fields: currentFields.filter((f) => f !== fieldName),
    })
  }

  // Handle adding a field to modal
  const handleAddModalField = (fieldName: string) => {
    const currentFields = localConfig.calendar_modal_fields || []
    if (!currentFields.includes(fieldName)) {
      setLocalConfig({
        ...localConfig,
        calendar_modal_fields: [...currentFields, fieldName],
      })
      // Reset the select dropdown
      setAddModalFieldValue('')
    }
  }

  // Handle removing a field from modal
  const handleRemoveModalField = (fieldName: string) => {
    const currentFields = localConfig.calendar_modal_fields || []
    setLocalConfig({
      ...localConfig,
      calendar_modal_fields: currentFields.filter((f) => f !== fieldName),
    })
  }

  async function handleSave() {
    await onSave(localConfig)
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Calendar Settings</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Date Field Selection */}
          <div className="space-y-2">
            <Label>Date Field</Label>
            <Select
              value={localConfig.calendar_date_field || '__none__'}
              onValueChange={(value) =>
                setLocalConfig({ ...localConfig, calendar_date_field: value === '__none__' ? null : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select date field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {dateFields.map((field) => (
                  <SelectItem key={field.id} value={field.name}>
                    {field.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">Use a single date field for events</p>
          </div>

          {/* OR Start/End Fields */}
          <div className="space-y-2">
            <Label>Start Date Field</Label>
            <Select
              value={localConfig.calendar_start_field || '__none__'}
              onValueChange={(value) =>
                setLocalConfig({ ...localConfig, calendar_start_field: value === '__none__' ? null : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select start date field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {dateFields.map((field) => (
                  <SelectItem key={field.id} value={field.name}>
                    {field.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>End Date Field</Label>
            <Select
              value={localConfig.calendar_end_field || '__none__'}
              onValueChange={(value) =>
                setLocalConfig({ ...localConfig, calendar_end_field: value === '__none__' ? null : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select end date field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {dateFields.map((field) => (
                  <SelectItem key={field.id} value={field.name}>
                    {field.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">Use start + end fields for multi-day events</p>
          </div>

          {/* Color Field */}
          <div className="space-y-2">
            <Label>Color Field (Optional)</Label>
            <Select
              value={localConfig.calendar_color_field || '__none__'}
              onValueChange={(value) =>
                setLocalConfig({ ...localConfig, calendar_color_field: value === '__none__' ? null : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select color field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {selectFields.map((field) => (
                  <SelectItem key={field.id} value={field.name}>
                    {field.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">Use a select field to color-code events</p>
          </div>

          {/* First Day of Week */}
          <div className="space-y-2">
            <Label>First Day of Week</Label>
            <Select
              value={localConfig.first_day_of_week.toString()}
              onValueChange={(value) =>
                setLocalConfig({ ...localConfig, first_day_of_week: parseInt(value) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sunday</SelectItem>
                <SelectItem value="1">Monday</SelectItem>
                <SelectItem value="2">Tuesday</SelectItem>
                <SelectItem value="3">Wednesday</SelectItem>
                <SelectItem value="4">Thursday</SelectItem>
                <SelectItem value="5">Friday</SelectItem>
                <SelectItem value="6">Saturday</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Show Weekends */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show Weekends</Label>
              <p className="text-xs text-gray-500">Display Saturday and Sunday columns</p>
            </div>
            <Switch
              checked={localConfig.show_weekends}
              onCheckedChange={(checked) => setLocalConfig({ ...localConfig, show_weekends: checked })}
            />
          </div>

          {/* Event Density */}
          <div className="space-y-2">
            <Label>Event Density</Label>
            <Select
              value={localConfig.event_density}
              onValueChange={(value: 'compact' | 'expanded') =>
                setLocalConfig({ ...localConfig, event_density: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact (3 events per day)</SelectItem>
                <SelectItem value="expanded">Expanded (5 events per day)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fields to Show on Cards */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label>Fields to Show on Cards</Label>
                <p className="text-xs text-gray-500">
                  Choose which fields appear on each calendar entry card (in addition to the title). Drag to reorder.
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
                items={selectedDisplayFields.map((f) => f.name)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 max-h-[200px] overflow-y-auto border border-gray-200 rounded-md p-2">
                  {selectedDisplayFields.length > 0 ? (
                    selectedDisplayFields.map((field) => (
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
          </div>

          {/* Fields to Show in Modal */}
          <div className="space-y-2 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <Label>Fields to Show in Modal</Label>
                <p className="text-xs text-gray-500">
                  Choose which fields appear when clicking on a calendar entry. Drag to reorder. Leave empty to show all fields.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // Select all fields
                    const allFieldNames = availableModalFields.map(f => f.name)
                    setLocalConfig({
                      ...localConfig,
                      calendar_modal_fields: allFieldNames,
                    })
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
                    setLocalConfig({
                      ...localConfig,
                      calendar_modal_fields: [],
                    })
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
                items={selectedModalFields.map((f) => f.name)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 max-h-[200px] overflow-y-auto border border-gray-200 rounded-md p-2">
                  {selectedModalFields.length > 0 ? (
                    selectedModalFields.map((field) => (
                      <SortableFieldItem
                        key={field.id}
                        field={field}
                        onRemove={() => handleRemoveModalField(field.name)}
                      />
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 italic text-center py-4">
                      No fields selected. All fields will be shown in the modal. Add fields using the dropdown above to limit what's displayed.
                    </p>
                  )}
                </div>
              </SortableContext>
            </DndContext>

            {availableModalFields.length === 0 && (
              <p className="text-xs text-gray-400 italic">No fields available to display</p>
            )}
          </div>

          {/* User Dropdown Filters */}
          <div className="space-y-2 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <Label>User Dropdown Filters</Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select fields to show as dropdown filters at the top of the calendar
                </p>
              </div>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto border border-gray-200 rounded-md p-2">
              {selectFields.length > 0 ? (
                selectFields.map((field) => {
                  const isSelected = (localConfig.user_dropdown_filters || []).includes(field.name)
                  return (
                    <label
                      key={field.id}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const currentFilters = localConfig.user_dropdown_filters || []
                          if (e.target.checked) {
                            setLocalConfig({
                              ...localConfig,
                              user_dropdown_filters: [...currentFilters, field.name],
                            })
                          } else {
                            setLocalConfig({
                              ...localConfig,
                              user_dropdown_filters: currentFilters.filter((f) => f !== field.name),
                            })
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{field.name}</span>
                      <span className="text-xs text-gray-400">({field.type})</span>
                    </label>
                  )
                })
              ) : (
                <p className="text-xs text-gray-400 italic">No select fields available. Add single-select or multi-select fields to enable filters.</p>
              )}
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Settings</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
