/**
 * Clipboard parsing and formatting for copy/paste operations
 * Handles plain text format: tab-separated columns, newline-separated rows
 */

/**
 * Parse clipboard text into a 2D grid
 * @param text - Clipboard text (tab-separated columns, newline-separated rows)
 * @returns 2D array of values [row][column]
 */
export function parseClipboardText(text: string): string[][] {
  if (!text || text.trim().length === 0) {
    return []
  }

  // Split by newlines (handle both \n and \r\n)
  const lines = text.split(/\r?\n/)
  
  // Split each line by tabs
  return lines.map(line => line.split('\t'))
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
 * @param value - Cell value (any type)
 * @returns Plain text string
 */
export function formatCellValue(value: any): string {
  if (value === null || value === undefined) {
    return ''
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
 * @param text - Clipboard text value
 * @param fieldType - Field type for type-specific parsing
 * @returns Parsed value
 */
export function parseCellValue(text: string, fieldType?: string): any {
  if (!text || text.trim().length === 0) {
    return null
  }

  const trimmed = text.trim()

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
