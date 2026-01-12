"use client"

import { useMemo } from "react"
import {
  resolveChoiceColor,
  getTextColorForBackground,
  normalizeHexColor,
} from "@/lib/field-colors"
import type { TableField } from "@/types/fields"

interface TimelineFieldValueProps {
  field: TableField
  value: any
  compact?: boolean // For compact card display
}

/**
 * Renders a field value for Timeline cards using the same styling as grid views
 * - Select fields render as colored pills
 * - Linked fields render as pills
 * - Lookup fields render read-only
 * - Text/number fields render inline
 */
export default function TimelineFieldValue({
  field,
  value,
  compact = false,
}: TimelineFieldValueProps) {
  // Handle null/undefined/empty values
  if (value === null || value === undefined || value === "") {
    return <span className="text-gray-400 italic text-xs">—</span>
  }

  // Single select - render as colored pill
  if (field.type === "single_select") {
    const normalizedValue = String(value).trim()
    const hexColor = resolveChoiceColor(
      normalizedValue,
      "single_select",
      field.options,
      true // Use semantic colors
    )
    const textColorClass = getTextColorForBackground(hexColor)
    const bgColor = normalizeHexColor(hexColor)

    return (
      <span
        className={`px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${textColorClass}`}
        style={{
          backgroundColor: bgColor,
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
        }}
      >
        {normalizedValue}
      </span>
    )
  }

  // Multi select - render multiple pills
  if (field.type === "multi_select") {
    const values = Array.isArray(value) ? value : [value]
    if (values.length === 0) {
      return <span className="text-gray-400 italic text-xs">—</span>
    }

    return (
      <div className="flex flex-wrap gap-1">
        {values.map((val: string, idx: number) => {
          const normalizedValue = String(val).trim()
          const hexColor = resolveChoiceColor(
            normalizedValue,
            "multi_select",
            field.options,
            false // Use muted colors for multi-select
          )
          const textColorClass = getTextColorForBackground(hexColor)
          const bgColor = normalizeHexColor(hexColor)

          return (
            <span
              key={idx}
              className={`px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${textColorClass}`}
              style={{
                backgroundColor: bgColor,
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
              }}
            >
              {normalizedValue}
            </span>
          )
        })}
      </div>
    )
  }

  // Linked field - render as pill (read-only in timeline)
  if (field.type === "link_to_table") {
    const linkedRecords = Array.isArray(value) ? value : value ? [value] : []
    if (linkedRecords.length === 0) {
      return <span className="text-gray-400 italic text-xs">—</span>
    }

    return (
      <div className="flex flex-wrap gap-1">
        {linkedRecords.slice(0, compact ? 1 : 3).map((record: any, idx: number) => {
          const label = typeof record === "string" ? record : record?.label || record?.id || "Linked"
          return (
            <span
              key={idx}
              className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 whitespace-nowrap"
            >
              {label}
            </span>
          )
        })}
        {linkedRecords.length > (compact ? 1 : 3) && (
          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-500">
            +{linkedRecords.length - (compact ? 1 : 3)}
          </span>
        )}
      </div>
    )
  }

  // Lookup field - render read-only
  if (field.type === "lookup") {
    return (
      <span className="text-xs text-gray-600">
        {typeof value === "object" ? JSON.stringify(value) : String(value)}
      </span>
    )
  }

  // Checkbox
  if (field.type === "checkbox") {
    return (
      <span className="text-xs">
        {value ? "✓" : "—"}
      </span>
    )
  }

  // Date
  if (field.type === "date") {
    try {
      const date = value instanceof Date ? value : new Date(value)
      if (!isNaN(date.getTime())) {
        return (
          <span className="text-xs text-gray-700">
            {date.toLocaleDateString()}
          </span>
        )
      }
    } catch {
      // Fall through to default
    }
  }

  // Number, percent, currency
  if (field.type === "number" || field.type === "percent" || field.type === "currency") {
    const numValue = typeof value === "number" ? value : parseFloat(String(value))
    if (!isNaN(numValue)) {
      let formatted = numValue.toLocaleString()
      if (field.type === "percent") {
        formatted = `${formatted}%`
      } else if (field.type === "currency") {
        formatted = `£${formatted}`
      }
      return <span className="text-xs text-gray-700 font-medium">{formatted}</span>
    }
  }

  // Text, long_text, and other types - render as plain text
  const textValue = String(value)
  return (
    <span className={`text-xs text-gray-700 ${compact ? "truncate" : ""}`} title={textValue}>
      {textValue}
    </span>
  )
}
