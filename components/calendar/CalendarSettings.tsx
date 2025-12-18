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
              value={localConfig.calendar_date_field || ''}
              onValueChange={(value) =>
                setLocalConfig({ ...localConfig, calendar_date_field: value || null })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select date field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
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
              value={localConfig.calendar_start_field || ''}
              onValueChange={(value) =>
                setLocalConfig({ ...localConfig, calendar_start_field: value || null })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select start date field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
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
              value={localConfig.calendar_end_field || ''}
              onValueChange={(value) =>
                setLocalConfig({ ...localConfig, calendar_end_field: value || null })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select end date field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
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
              value={localConfig.calendar_color_field || ''}
              onValueChange={(value) =>
                setLocalConfig({ ...localConfig, calendar_color_field: value || null })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select color field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
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
