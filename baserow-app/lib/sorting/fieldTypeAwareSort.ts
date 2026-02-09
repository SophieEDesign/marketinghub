/**
 * Field-Type Aware Sorting
 * 
 * Implements intelligent sorting based on field types:
 * - Status/single_select: Sort by the order in field.options.selectOptions (sort_index) - source of truth
 * - Dates: Sort as dates (timestamptz)
 * - Multi-select: Sort by first value's sort_index from selectOptions
 * - Other types: Standard sorting
 */

import type { TableField, LinkedField } from '@/types/fields'
import { normalizeSelectOptionsForUi } from '@/lib/fields/select-options'
import { resolveLinkedFieldDisplayMap } from '@/lib/dataView/linkedFields'
import { linkedValueToIds } from '@/lib/dataView/linkedFields'

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
 * Always returns a Promise for consistency (resolves immediately for sync cases)
 */
export async function sortRowsByFieldType(
  rows: Record<string, any>[],
  sorts: ViewSort[],
  tableFields: TableField[]
): Promise<Record<string, any>[]> {
  if (!sorts || sorts.length === 0) {
    return rows
  }

  // Check if any sort requires async resolution (linked/lookup fields)
  const needsAsync = sorts.some(sort => {
    const field = findFieldByName(tableFields, sort.field_name)
    return field && (field.type === 'link_to_table' || field.type === 'lookup')
  })

  if (needsAsync) {
    // Async sorting for linked/lookup fields
    return sortRowsByFieldTypeAsync(rows, sorts, tableFields)
  }

  // Synchronous sorting for non-linked fields (wrap in Promise for consistency)
  return Promise.resolve(sortRowsByFieldTypeSync(rows, sorts, tableFields))
}

/**
 * Synchronous sorting (for non-linked fields)
 */
function sortRowsByFieldTypeSync(
  rows: Record<string, any>[],
  sorts: ViewSort[],
  tableFields: TableField[]
): Record<string, any>[] {
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
 * Async sorting (for linked/lookup fields that need label resolution)
 */
async function sortRowsByFieldTypeAsync(
  rows: Record<string, any>[],
  sorts: ViewSort[],
  tableFields: TableField[]
): Promise<Record<string, any>[]> {
  // Create a copy to avoid mutating the original
  let sortedRows = [...rows]

  // Sort the sorts by order_index if available
  const sortedSorts = [...sorts].sort((a, b) => {
    const aOrder = (a as any).order_index ?? 0
    const bOrder = (b as any).order_index ?? 0
    return aOrder - bOrder
  })

  // Apply sorts in reverse order
  for (let i = sortedSorts.length - 1; i >= 0; i--) {
    const sort = sortedSorts[i]
    const field = findFieldByName(tableFields, sort.field_name)

    if (!field) {
      continue
    }

    // Pre-resolve labels for linked fields
    let labelMap: Map<string, string> | null = null
    if (field.type === 'link_to_table') {
      const linkedField = field as LinkedField
      const allIds = new Set<string>()
      for (const row of sortedRows) {
        const key = Object.prototype.hasOwnProperty.call(row, sort.field_name)
          ? sort.field_name
          : field.name
        const fieldValue = (row as any)[key]
        const ids = linkedValueToIds(fieldValue)
        ids.forEach(id => allIds.add(id))
      }
      if (allIds.size > 0) {
        labelMap = await resolveLinkedFieldDisplayMap(linkedField, Array.from(allIds))
      }
    }

    sortedRows = sortedRows.sort((a, b) => {
      const key =
        Object.prototype.hasOwnProperty.call(a, sort.field_name) ||
        Object.prototype.hasOwnProperty.call(b, sort.field_name)
          ? sort.field_name
          : field.name
      const comparison = compareValues(
        (a as any)[key],
        (b as any)[key],
        field,
        sort.direction === 'asc',
        labelMap
      )
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
  ascending: boolean,
  labelMap?: Map<string, string> | null
): number {
  const multiplier = ascending ? 1 : -1

  // Handle null/undefined values (always sort to end, regardless of direction)
  if (a === null || a === undefined) {
    if (b === null || b === undefined) return 0
    return 1 // a is null, b is not - a always goes after (end)
  }
  if (b === null || b === undefined) {
    return -1 // b is null, a is not - b always goes after (end)
  }

  // Handle linked fields - sort by display labels, not IDs
  if (field.type === 'link_to_table' && labelMap) {
    const linkedField = field as LinkedField
    const getLabel = (value: any): string => {
      if (!value) return ''
      const ids = linkedValueToIds(value)
      if (ids.length === 0) return ''
      // Get first ID's label (for multi-link, sort by first linked record)
      const firstId = ids[0]
      return labelMap!.get(firstId) || firstId
    }
    const aLabel = getLabel(a)
    const bLabel = getLabel(b)
    return aLabel.localeCompare(bLabel) * multiplier
  }

  // Handle lookup fields - sort by computed value (already resolved)
  if (field.type === 'lookup') {
    // Lookup fields are computed values, sort as strings
    return String(a).localeCompare(String(b)) * multiplier
  }

  switch (field.type) {
    case 'single_select': {
      // Sort by the order in field.options.selectOptions (sort_index) - this is the source of truth
      // ASC: lower sort_index values come first (multiplier = 1)
      // DESC: higher sort_index values come first (multiplier = -1)
      const { selectOptions } = normalizeSelectOptionsForUi('single_select', field.options)
      const indexByLabel = new Map<string, number>()
      for (const o of selectOptions) {
        indexByLabel.set(o.label, o.sort_index)
      }
      
      const aLabel = String(a)
      const bLabel = String(b)
      const aOrder = indexByLabel.get(aLabel) ?? Number.POSITIVE_INFINITY
      const bOrder = indexByLabel.get(bLabel) ?? Number.POSITIVE_INFINITY
      
      // Apply direction: ASC (multiplier=1) means lower sort_index first, DESC (multiplier=-1) means higher sort_index first
      return (aOrder - bOrder) * multiplier
    }

    case 'multi_select': {
      // Sort by first value's sort_index from selectOptions
      // ASC: lower sort_index values come first (multiplier = 1)
      // DESC: higher sort_index values come first (multiplier = -1)
      const { selectOptions } = normalizeSelectOptionsForUi('multi_select', field.options)
      const indexByLabel = new Map<string, number>()
      for (const o of selectOptions) {
        indexByLabel.set(o.label, o.sort_index)
      }
      
      const aFirst = Array.isArray(a) && a.length > 0 ? String(a[0]) : ''
      const bFirst = Array.isArray(b) && b.length > 0 ? String(b[0]) : ''
      
      // If empty, sort to end (regardless of direction)
      if (!aFirst && !bFirst) return 0
      if (!aFirst) return 1 // a is empty, b is not - a always goes after (end)
      if (!bFirst) return -1 // b is empty, a is not - b always goes after (end)
      
      const aOrder = indexByLabel.get(aFirst) ?? Number.POSITIVE_INFINITY
      const bOrder = indexByLabel.get(bFirst) ?? Number.POSITIVE_INFINITY
      
      // Apply direction: ASC (multiplier=1) means lower sort_index first, DESC (multiplier=-1) means higher sort_index first
      if (aOrder !== bOrder) {
        return (aOrder - bOrder) * multiplier
      }
      // If same order, fall back to label comparison for stability (also respects direction)
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
  // Linked fields need client-side sorting to sort by display labels, not IDs.
  return (
    fieldType === 'single_select' ||
    fieldType === 'multi_select' ||
    fieldType === 'formula' ||
    fieldType === 'lookup' ||
    fieldType === 'link_to_table'
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
