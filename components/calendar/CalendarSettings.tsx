"use client"

import { useState, useEffect } from 'react'
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

  useEffect(() => {
    setLocalConfig(config)
  }, [config, open])

  const dateFields = tableFields.filter((f) => f.type === 'date')
  const selectFields = tableFields.filter((f) => f.type === 'single_select' || f.type === 'multi_select')

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

          {/* Display Fields */}
          <div className="space-y-2">
            <Label>Fields to Display on Calendar Entries</Label>
            <p className="text-xs text-gray-500">
              Choose which fields appear on each calendar entry (in addition to the title)
            </p>
            <div className="space-y-2 max-h-[200px] overflow-y-auto border border-gray-200 rounded-md p-2">
              {tableFields
                .filter((f) => f.type !== 'date' && f.type !== 'attachment')
                .map((field) => {
                  const isSelected = (localConfig.calendar_display_fields || []).includes(field.name)
                  return (
                    <label
                      key={field.id}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const currentFields = localConfig.calendar_display_fields || []
                          if (e.target.checked) {
                            setLocalConfig({
                              ...localConfig,
                              calendar_display_fields: [...currentFields, field.name],
                            })
                          } else {
                            setLocalConfig({
                              ...localConfig,
                              calendar_display_fields: currentFields.filter((f) => f !== field.name),
                            })
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{field.name}</span>
                      <span className="text-xs text-gray-400">({field.type})</span>
                    </label>
                  )
                })}
            </div>
            {tableFields.filter((f) => f.type !== 'date' && f.type !== 'attachment').length === 0 && (
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
