"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TableField } from "@/types/fields"
import type { FilterOperator } from "@/lib/filters/canonical-model"
import {
  resolveChoiceColor,
  normalizeHexColor,
} from "@/lib/field-colors"

interface FilterValueInputProps {
  field: TableField | null
  operator: FilterOperator
  value: string | number | boolean | string[] | null | undefined
  onChange: (value: string | number | boolean | string[] | null) => void
  placeholder?: string
}

/**
 * Field-aware filter value input component
 * 
 * Renders the appropriate input based on field type:
 * - Select fields: Dropdown with options and colors
 * - Multi-select: Multi-select dropdown (future)
 * - Date fields: Date picker
 * - Number fields: Number input
 * - Text fields: Text input
 * - Linked fields: Record picker (future)
 * - Lookup fields: Read-only display
 */
export default function FilterValueInput({
  field,
  operator,
  value,
  onChange,
  placeholder = "Enter value...",
}: FilterValueInputProps) {
  // Operators that don't require a value
  const noValueOperators: FilterOperator[] = ['is_empty', 'is_not_empty']
  const needsValue = !noValueOperators.includes(operator)

  if (!needsValue) {
    return (
      <div className="h-9 flex items-center text-xs text-gray-500 px-3">
        No value needed
      </div>
    )
  }

  if (!field) {
    return (
      <Input
        type="text"
        value={value as string || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 text-sm"
      />
    )
  }

  // Select fields: Show dropdown with options and colors
  if (field.type === 'single_select' || field.type === 'multi_select') {
    const choices = field.options?.choices || []
    
    if (choices.length === 0) {
      return (
        <div className="h-9 flex items-center text-xs text-gray-400 px-3">
          No options available
        </div>
      )
    }

    return (
      <Select
        value={value as string || ""}
        onValueChange={(val) => onChange(val)}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Select value...">
            {value && (
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: normalizeHexColor(
                      resolveChoiceColor(
                        value as string,
                        field.type,
                        field.options,
                        field.type === 'single_select'
                      )
                    ),
                  }}
                />
                <span>{value}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice: string) => {
            const hexColor = resolveChoiceColor(
              choice,
              field.type as 'single_select' | 'multi_select',
              field.options,
              field.type === 'single_select'
            )
            const bgColor = normalizeHexColor(hexColor)
            return (
              <SelectItem key={choice} value={choice}>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: bgColor }}
                  />
                  <span>{choice}</span>
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    )
  }

  // Date fields: Date picker
  if (field.type === 'date') {
    const singleDateOperators: FilterOperator[] = [
      'date_equal',
      'date_before',
      'date_after',
      'date_on_or_before',
      'date_on_or_after',
    ]

    // "Today" operator - no value needed
    if (operator === 'date_today') {
      return (
        <div className="h-9 flex items-center text-xs text-gray-500 px-3">
          No value needed
        </div>
      )
    }

    // "Next X days" operator - number input
    if (operator === 'date_next_days') {
      return (
        <Input
          type="number"
          min="1"
          value={value as number || ""}
          onChange={(e) => {
            const numValue = e.target.value === '' ? null : parseInt(e.target.value) || 1
            onChange(numValue as any)
          }}
          placeholder="Number of days"
          className="h-9 text-sm"
        />
      )
    }

    if (operator === 'date_range') {
      // Date range requires two values
      const rangeValue = value as { start?: string; end?: string } | string | null
      const start = typeof rangeValue === 'object' && rangeValue?.start ? rangeValue.start : ''
      const end = typeof rangeValue === 'object' && rangeValue?.end ? rangeValue.end : ''
      
      return (
        <div className="flex gap-2">
          <Input
            type="date"
            value={start}
            onChange={(e) => onChange({ start: e.target.value, end } as any)}
            placeholder="Start date"
            className="h-9 text-sm"
          />
          <Input
            type="date"
            value={end}
            onChange={(e) => onChange({ start, end: e.target.value } as any)}
            placeholder="End date"
            className="h-9 text-sm"
          />
        </div>
      )
    }

    // Single-date operators: allow dynamic "Today" without hardcoding a date
    if (singleDateOperators.includes(operator)) {
      const isToday = value === '__TODAY__'
      const mode = isToday ? 'today' : 'specific'

      return (
        <div className="flex gap-2 items-center">
          <Select
            value={mode}
            onValueChange={(val) => {
              if (val === 'today') {
                onChange('__TODAY__')
              } else {
                // Switch back to specific date; keep current date if it exists, otherwise clear.
                onChange(isToday ? '' : (value as any) ?? '')
              }
            }}
          >
            <SelectTrigger className="h-9 w-32 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="specific">Specific</SelectItem>
              <SelectItem value="today">Today</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={isToday ? '' : (value as string || "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Select date"
            className="h-9 text-sm flex-1"
            disabled={isToday}
          />
        </div>
      )
    }

    return (
      <Input
        type="date"
        value={value as string || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Select date"
        className="h-9 text-sm"
      />
    )
  }

  // Number fields: Number input
  if (field.type === 'number' || field.type === 'currency' || field.type === 'percent') {
    return (
      <Input
        type="number"
        value={value as number || ""}
        onChange={(e) => {
          const numValue = e.target.value === '' ? null : parseFloat(e.target.value)
          onChange(numValue as any)
        }}
        placeholder="Enter number"
        className="h-9 text-sm"
        step={field.type === 'number' ? 'any' : undefined}
      />
    )
  }

  // Checkbox: Boolean input
  if (field.type === 'checkbox') {
    return (
      <Select
        value={value === true ? 'true' : value === false ? 'false' : ''}
        onValueChange={(val) => onChange(val === 'true')}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Checked</SelectItem>
          <SelectItem value="false">Unchecked</SelectItem>
        </SelectContent>
      </Select>
    )
  }

  // Linked fields: Show placeholder (record picker to be implemented)
  if (field.type === 'link_to_table') {
    return (
      <div className="h-9 flex items-center text-xs text-gray-400 px-3 border border-gray-300 rounded-md">
        Record picker (coming soon)
      </div>
    )
  }

  // Lookup fields: Read-only display
  if (field.type === 'lookup') {
    return (
      <div className="h-9 flex items-center text-xs text-gray-400 px-3 border border-gray-300 rounded-md bg-gray-50">
        Filter by derived value
      </div>
    )
  }

  // Default: Text input
  return (
    <Input
      type="text"
      value={value as string || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 text-sm"
    />
  )
}
