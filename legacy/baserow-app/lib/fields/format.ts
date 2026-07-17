/**
 * Field value formatting utilities
 * Respects field options (date_format, precision, currency_symbol) for display.
 */

import { format, parseISO, isValid } from "date-fns"
import type { TableField } from "@/types/fields"
import { formatDateUK } from "@/lib/utils"

/**
 * Formats a date value using the field's date_format option when set.
 * Falls back to UK format (dd/MM/yyyy) when no format is configured.
 */
export function formatDateByField(
  dateValue: string | null | undefined,
  field: Pick<TableField, "type" | "options">,
  placeholder: string = "—"
): string {
  if (!dateValue) return placeholder

  try {
    const date = parseISO(dateValue)
    if (!isValid(date)) return placeholder

    const dateFormat = field.options?.date_format
    if (dateFormat && typeof dateFormat === "string") {
      return format(date, dateFormat)
    }
    return formatDateUK(dateValue, placeholder)
  } catch {
    return placeholder
  }
}

/**
 * Formats a numeric value (number, percent, currency) using field options.
 * Applies precision, currency_symbol, and percent suffix as configured.
 */
export function formatNumericValue(
  value: number | null | undefined,
  field: Pick<TableField, "type" | "options">,
  placeholder: string = "—"
): string {
  if (value === null || value === undefined) return placeholder
  if (typeof value !== "number" || isNaN(value)) return placeholder

  const precision = field.options?.precision
  const formatted =
    precision !== undefined ? value.toFixed(precision) : value.toLocaleString()

  if (field.type === "percent") {
    return `${formatted}%`
  }
  if (field.type === "currency") {
    const symbol = field.options?.currency_symbol ?? "$"
    return `${symbol}${formatted}`
  }
  return formatted
}
