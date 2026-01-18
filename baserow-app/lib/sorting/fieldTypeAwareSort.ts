/**
 * Field-Type Aware Sorting
 * 
 * Implements intelligent sorting based on field types:
 * - Status/single_select: Sort by the order of choices in options.choices array
 * - Dates: Sort as dates (timestamptz)
 * - Multi-select: Sort by first value in the array
 * - Other types: Standard sorting
 */

import type { TableField } from '@/types/fields'
import { getOrderedSelectLabels } from '@/lib/fields/select-options'

export interface ViewSort {
  field_name: string
  direction: 'asc' | 'desc'
  order_index?: number
}

function findFieldByName(tableFields: TableField[], fieldName: string): TableField | undefined {
  if (!fieldName) return undefined
  const direct = tableFields.find((f) => f?.name === fieldName)
  if (direct) return direct
  const lower = fieldName.toLowerCase()
  return tableFields.find((f) => typeof f?.name === 'string' && f.name.toLowerCase() === lower)
}

/**
 * Sort rows based on field type
 */
export function sortRowsByFieldType(
  rows: Record<string, any>[],
  sorts: ViewSort[],
  tableFields: TableField[]
): Record<string, any>[] {
  if (!sorts || sorts.length === 0) {
    return rows
  }

  // Create a copy to avoid mutating the original
  let sortedRows = [...rows]

  // Sort the sorts by order_index if available (to ensure correct sort order)
  const sortedSorts = [...sorts].sort((a, b) => {
    const aOrder = (a as any).order_index ?? 0
    const bOrder = (b as any).order_index ?? 0
    return aOrder - bOrder
  })

  // Apply sorts in reverse order (last sort applied becomes primary)
  // We want the sort with lowest order_index (first in sortedSorts) to be primary,
  // so we apply sorts with highest order_index first, then lowest order_index last
  for (let i = sortedSorts.length - 1; i >= 0; i--) {
    const sort = sortedSorts[i]
    const field = findFieldByName(tableFields, sort.field_name)

    if (!field) {
      // Field not found - skip this sort
      continue
    }

    sortedRows = sortedRows.sort((a, b) => {
      // Prefer the exact key from the row if present; otherwise fall back to the field's canonical name.
      const key =
        Object.prototype.hasOwnProperty.call(a, sort.field_name) ||
        Object.prototype.hasOwnProperty.call(b, sort.field_name)
          ? sort.field_name
          : field.name
      const comparison = compareValues(
        (a as any)[key],
        (b as any)[key],
        field,
        sort.direction === 'asc'
      )
      // If values are equal, maintain previous sort order (stable sort)
      return comparison !== 0 ? comparison : 0
    })
  }

  return sortedRows
}

/**
 * Compare two values based on field type
 */
function compareValues(
  a: any,
  b: any,
  field: TableField,
  ascending: boolean
): number {
  const multiplier = ascending ? 1 : -1

  // Handle null/undefined values (always sort to end)
  if (a === null || a === undefined) {
    if (b === null || b === undefined) return 0
    return 1 * multiplier // a is null, b is not - a goes after
  }
  if (b === null || b === undefined) {
    return -1 * multiplier // b is null, a is not - b goes after
  }

  switch (field.type) {
    case 'single_select': {
      // Sort by the order in options.select_options / options.choices
      const choices = getOrderedSelectLabels('single_select', field.options)
      const aIndex = choices.indexOf(String(a))
      const bIndex = choices.indexOf(String(b))
      
      // If value not found in choices, treat as -1 (sort to end)
      const aOrder = aIndex === -1 ? Infinity : aIndex
      const bOrder = bIndex === -1 ? Infinity : bIndex
      
      return (aOrder - bOrder) * multiplier
    }

    case 'multi_select': {
      // Sort by first value in array
      const aFirst = Array.isArray(a) && a.length > 0 ? String(a[0]) : ''
      const bFirst = Array.isArray(b) && b.length > 0 ? String(b[0]) : ''
      
      return aFirst.localeCompare(bFirst) * multiplier
    }

    case 'date': {
      // Sort as dates
      const aDate = a instanceof Date ? a : new Date(a)
      const bDate = b instanceof Date ? b : new Date(b)
      
      if (isNaN(aDate.getTime())) {
        return isNaN(bDate.getTime()) ? 0 : 1 * multiplier
      }
      if (isNaN(bDate.getTime())) {
        return -1 * multiplier
      }
      
      return (aDate.getTime() - bDate.getTime()) * multiplier
    }

    case 'number':
    case 'percent':
    case 'currency': {
      // Sort as numbers
      const aNum = typeof a === 'number' ? a : parseFloat(String(a))
      const bNum = typeof b === 'number' ? b : parseFloat(String(b))
      
      if (isNaN(aNum)) {
        return isNaN(bNum) ? 0 : 1 * multiplier
      }
      if (isNaN(bNum)) {
        return -1 * multiplier
      }
      
      return (aNum - bNum) * multiplier
    }

    case 'checkbox': {
      // Sort boolean: false first when ascending
      const aBool = Boolean(a)
      const bBool = Boolean(b)
      
      if (aBool === bBool) return 0
      return (aBool ? 1 : -1) * multiplier
    }

    default: {
      // Default: string comparison
      return String(a).localeCompare(String(b)) * multiplier
    }
  }
}

/**
 * Check if a field type requires client-side sorting
 * (i.e., cannot be sorted efficiently at the database level)
 */
export function requiresClientSideSorting(fieldType: string): boolean {
  // Virtual fields don't exist as physical DB columns (must sort after computing/expanding).
  // Selects also need client-side sorting to respect choice order / first multi value.
  return (
    fieldType === 'single_select' ||
    fieldType === 'multi_select' ||
    fieldType === 'formula' ||
    fieldType === 'lookup'
  )
}

/**
 * Determine if we should use database sorting or client-side sorting
 */
export function shouldUseClientSideSorting(
  sorts: ViewSort[],
  tableFields: TableField[]
): boolean {
  // Use client-side sorting if any sort field requires it
  return sorts.some(sort => {
    const field = findFieldByName(tableFields, sort.field_name)
    return field && requiresClientSideSorting(field.type)
  })
}
