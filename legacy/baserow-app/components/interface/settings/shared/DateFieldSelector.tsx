"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TableField } from "@/types/database"
import { getFieldDisplayName } from "@/lib/fields/display"

interface DateFieldSelectorProps {
  startDateField: string | undefined
  endDateField: string | undefined
  onStartDateChange: (fieldName: string | undefined) => void
  onEndDateChange: (fieldName: string | undefined) => void
  fields: TableField[]
  label?: string
  description?: string
  requireEndDate?: boolean
}

export default function DateFieldSelector({
  startDateField,
  endDateField,
  onStartDateChange,
  onEndDateChange,
  fields,
  label = "Date settings",
  description,
  requireEndDate = false,
}: DateFieldSelectorProps) {
  const dateFields = fields.filter((f) => f.type === "date")

  return (
    <div className="space-y-3">
      <Label className="text-xs font-medium text-gray-700">{label}</Label>

      {/* Start Date Field */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-gray-700">Date settings</Label>
        <Select
          value={startDateField || ""}
          onValueChange={(value) => onStartDateChange(value || undefined)}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select a date field" />
          </SelectTrigger>
          <SelectContent>
            {dateFields.map((field) => (
              <SelectItem key={field.id} value={field.name}>
                {getFieldDisplayName(field)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {dateFields.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">
            No date fields found. Please add a date field to the table.
          </p>
        )}
      </div>

      {/* End Date Field (optional) */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-gray-700">
          End date {requireEndDate ? "" : "(optional)"}
        </Label>
        <Select
          value={endDateField || "__none__"}
          onValueChange={(value) =>
            onEndDateChange(value === "__none__" ? undefined : value)
          }
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select end date field (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None (single date events)</SelectItem>
            {dateFields.map((field) => (
              <SelectItem key={field.id} value={field.name}>
                {getFieldDisplayName(field)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {description ? (
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        ) : (
          <p className="text-xs text-gray-500 mt-1">
            Use start + end fields for date range events, or leave as &quot;None&quot; for single
            date events.
          </p>
        )}
      </div>
    </div>
  )
}
