"use client"

import { useMemo } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { View } from "@/types/database"

interface ViewSelectorProps {
  value: string | undefined
  onChange: (viewId: string | undefined) => void
  views: View[]
  tableId?: string
  label?: string
  description?: string
}

export default function ViewSelector({
  value,
  onChange,
  views,
  tableId,
  label = "View (optional)",
  description,
}: ViewSelectorProps) {
  // Filter views by table if tableId is provided
  const availableViews = useMemo(() => {
    if (!tableId) return views
    return views.filter((view) => view.table_id === tableId)
  }, [views, tableId])

  const displayValue = value || "__all__"

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={displayValue}
        onValueChange={(newValue) => {
          onChange(newValue === "__all__" ? undefined : newValue)
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="All views" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">**all**</SelectItem>
          {availableViews.map((view) => (
            <SelectItem key={view.id} value={view.id}>
              {view.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description ? (
        <p className="text-xs text-gray-500">{description}</p>
      ) : (
        <p className="text-xs text-gray-500">
          Optionally filter data to a specific view. Select "**all**" to use all records from the table.
        </p>
      )}
    </div>
  )
}
