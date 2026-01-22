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

interface GroupBySelectorProps {
  value: string | undefined
  onChange: (fieldName: string | undefined) => void
  fields: TableField[]
  label?: string
  description?: string
  filterGroupableFields?: boolean
  placeholder?: string
}

export default function GroupBySelector({
  value,
  onChange,
  fields,
  label = "Group by (Optional)",
  description,
  filterGroupableFields = true,
  placeholder = "Select a field",
}: GroupBySelectorProps) {
  // Filter out formula and lookup fields if filterGroupableFields is true
  const groupableFields = filterGroupableFields
    ? fields.filter((f) => f.type !== "formula" && f.type !== "lookup")
    : fields

  const displayValue = value || "__none__"

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={displayValue}
        onValueChange={(newValue) => {
          onChange(newValue === "__none__" ? undefined : newValue)
        }}
      >
        <SelectTrigger className="h-8">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">None (no grouping)</SelectItem>
          {groupableFields.map((field) => (
            <SelectItem key={field.id} value={field.name}>
              {getFieldDisplayName(field)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description ? (
        <p className="text-xs text-gray-500">{description}</p>
      ) : (
        <p className="text-xs text-gray-500">
          Group records by a field value. Records with the same value will be grouped together.
        </p>
      )}
    </div>
  )
}
