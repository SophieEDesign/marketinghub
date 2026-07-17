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

interface MarketingFieldSelectProps {
  label: string
  fieldId?: string
  fieldName?: string
  fields: TableField[]
  onChange: (fieldId: string | undefined, fieldName: string | undefined) => void
  optional?: boolean
  fieldTypes?: string[]
}

export default function MarketingFieldSelect({
  label,
  fieldId,
  fieldName,
  fields,
  onChange,
  optional = true,
  fieldTypes,
}: MarketingFieldSelectProps) {
  const filtered = fieldTypes?.length
    ? fields.filter((f) => fieldTypes.includes(f.type))
    : fields

  const value = fieldId || fieldName || "__auto__"

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
        {!optional ? <span className="text-red-500"> *</span> : null}
      </Label>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === "__auto__") {
            onChange(undefined, undefined)
            return
          }
          const field = filtered.find((f) => f.id === v)
          if (field) {
            onChange(field.id, field.name)
          }
        }}
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Auto-detect" />
        </SelectTrigger>
        <SelectContent>
          {optional ? <SelectItem value="__auto__">Auto-detect</SelectItem> : null}
          {filtered.map((field) => (
            <SelectItem key={field.id} value={field.id}>
              {getFieldDisplayName(field)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
