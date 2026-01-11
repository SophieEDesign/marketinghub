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

export interface ViewSort {
  field_name: string
  direction: 'asc' | 'desc'
  order_index?: number
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

  // Apply sorts in reverse order (last sort is primary)
  for (let i = sorts.length - 1; i >= 0; i--) {
    const sort = sorts[i]
    const field = tableFields.find(f => f.name === sort.field_name)

    if (!field) {
      // Field not found - skip this sort
      continue
    }

    sortedRows = sortedRows.sort((a, b) => {
      return compareValues(
        a[sort.field_name],
        b[sort.field_name],
        field,
        sort.direction === 'asc'
      )
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
      // Sort by the order in options.choices array
      const choices = field.options?.choices || []
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
  return fieldType === 'single_select' || fieldType === 'multi_select'
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
    const field = tableFields.find(f => f.name === sort.field_name)
    return field && requiresClientSideSorting(field.type)
  })
}
