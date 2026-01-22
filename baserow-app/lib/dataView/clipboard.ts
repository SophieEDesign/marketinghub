/**
 * Clipboard parsing and formatting for copy/paste operations
 * Handles plain text format: tab-separated columns, newline-separated rows
 */

import type { TableField } from '@/types/fields'
import { isLinkedField } from '@/types/fields'
import { resolveLinkedFieldDisplay } from './linkedFields'

/**
 * Parse clipboard text into a 2D grid
 * @param text - Clipboard text (tab-separated columns, newline-separated rows)
 * @returns 2D array of values [row][column]
 */
export function parseClipboardText(text: string): string[][] {
  if (!text || typeof text !== 'string') {
    return []
  }

  // Trim the entire text first
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return []
  }

  // Split by newlines (handle both \n and \r\n)
  // Preserve empty lines that might be intentional (e.g., empty rows in spreadsheet)
  const lines = trimmed.split(/\r?\n/)
  
  // Filter out completely empty lines at the end (trailing newlines)
  let lastNonEmptyIndex = lines.length - 1
  while (lastNonEmptyIndex >= 0 && lines[lastNonEmptyIndex].trim().length === 0) {
    lastNonEmptyIndex--
  }
  const trimmedLines = lines.slice(0, lastNonEmptyIndex + 1)
  
  // Split each line by tabs
  // Preserve empty cells (they represent empty values in the grid)
  return trimmedLines.map(line => {
    const cells = line.split('\t')
    // Return cells as-is (including empty strings for empty cells)
    return cells
  })
}

/**
 * Format data for clipboard (plain text, no formatting)
 * @param grid - 2D array of values [row][column]
 * @returns Plain text string (tab-separated columns, newline-separated rows)
 */
export function formatClipboardText(grid: string[][]): string {
  if (grid.length === 0) {
    return ''
  }

  // Join each row with tabs, then join rows with newlines
  return grid.map(row => row.join('\t')).join('\n')
}

/**
 * Format cell value for clipboard (plain text representation)
 * 
 * For linked fields, this returns display labels (comma-separated for multi-link).
 * For other fields, returns standard string representation.
 * 
 * Note: For linked fields, this is synchronous and returns IDs if display resolution
 * is needed. The caller (DataViewService.copy) should handle async resolution.
 * 
 * @param value - Cell value (any type)
 * @param field - Optional field definition (for linked field display resolution)
 * @returns Plain text string
 */
export function formatCellValue(value: any, field?: TableField): string {
  if (value === null || value === undefined) {
    return ''
  }

  // Linked fields: return IDs as-is (display resolution happens in DataViewService.copy)
  // This allows the async resolution to happen at the service level
  if (field && isLinkedField(field)) {
    if (Array.isArray(value)) {
      return value.join(', ')
    }
    return String(value)
  }

  // Handle arrays (e.g., multi-select)
  if (Array.isArray(value)) {
    return value.join(', ')
  }

  // Handle objects (e.g., JSON fields)
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  // Convert to string
  return String(value)
}

/**
 * Parse cell value from clipboard text
 * 
 * Note: For linked fields, this returns the raw text. Resolution to IDs
 * happens in validation.ts via resolvePastedLinkedValue().
 * 
 * @param text - Clipboard text value
 * @param fieldType - Field type for type-specific parsing
 * @returns Parsed value (raw text for linked fields, parsed for others)
 */
export function parseCellValue(text: string, fieldType?: string): any {
  if (!text || text.trim().length === 0) {
    return null
  }

  const trimmed = text.trim()

  // Linked fields: return raw text (will be resolved to IDs in validation)
  if (fieldType === 'link_to_table') {
    return trimmed
  }

  // Lookup fields: should never be parsed (read-only)
  if (fieldType === 'lookup') {
    return null // Explicitly reject
  }

  // Type-specific parsing
  switch (fieldType) {
    case 'number':
    case 'percent':
    case 'currency':
      const num = parseFloat(trimmed)
      return isNaN(num) ? null : num

    case 'checkbox':
      const lower = trimmed.toLowerCase()
      return lower === 'true' || lower === '1' || lower === 'yes'

    case 'date':
      // Try to parse as date
      const date = new Date(trimmed)
      return isNaN(date.getTime()) ? trimmed : date.toISOString()

    case 'json':
      try {
        return JSON.parse(trimmed)
      } catch {
        return trimmed
      }

    case 'multi_select':
      // Split by comma for multi-select
      return trimmed.split(',').map(s => s.trim()).filter(s => s.length > 0)

    default:
      return trimmed
  }
}
