/**
 * Field Layout Helpers for Modals
 * 
 * Utility functions for working with field_layout in modal contexts.
 * These functions help convert field_layout to visible fields lists
 * and determine field editability for RecordFields component.
 */

import type { FieldLayoutItem } from './field-layout-utils'
import type { TableField } from '@/types/fields'

/**
 * Get visible fields from field_layout for modal display
 * Filters by visible_in_modal !== false and sorts by order
 */
export function getVisibleFieldsFromLayout(
  fieldLayout: FieldLayoutItem[],
  allFields: TableField[]
): TableField[] {
  if (!fieldLayout || fieldLayout.length === 0) {
    // If no field_layout, return all fields (backward compatibility)
    return allFields
  }

  // Create a map of field names to TableField objects
  const fieldMap = new Map<string, TableField>()
  allFields.forEach((field) => {
    fieldMap.set(field.name, field)
    fieldMap.set(field.id, field)
  })

  // Filter and sort by field_layout
  const visibleItems = fieldLayout
    .filter((item) => item.visible_in_modal !== false)
    .sort((a, b) => a.order - b.order)

  // Convert to TableField array
  const visibleFields: TableField[] = []
  const processedFieldNames = new Set<string>()

  visibleItems.forEach((item) => {
    const field = fieldMap.get(item.field_name) || fieldMap.get(item.field_id)
    if (field && !processedFieldNames.has(field.name)) {
      visibleFields.push(field)
      processedFieldNames.add(field.name)
    }
  })

  // Add any fields that exist in allFields but not in field_layout
  // (for backward compatibility when new fields are added)
  allFields.forEach((field) => {
    if (!processedFieldNames.has(field.name)) {
      visibleFields.push(field)
    }
  })

  return visibleFields
}

/**
 * Determine if a field is editable based on field_layout
 */
export function isFieldEditableFromLayout(
  fieldName: string,
  fieldLayout: FieldLayoutItem[],
  pageEditable: boolean
): boolean {
  if (!pageEditable) return false

  if (!fieldLayout || fieldLayout.length === 0) {
    // If no field_layout, all fields are editable (backward compatibility)
    return true
  }

  const layoutItem = fieldLayout.find(
    (item) => item.field_name === fieldName || item.field_id === fieldName
  )

  if (!layoutItem) {
    // Field not in layout, default to editable
    return true
  }

  return layoutItem.editable !== false
}

/**
 * Convert modal_layout blocks to field_layout format
 * Used for backward compatibility with existing modal layouts
 */
export function convertModalLayoutToFieldLayout(
  modalLayout: { blocks?: Array<{ fieldName?: string; y?: number; config?: any }> },
  allFields: TableField[]
): FieldLayoutItem[] {
  if (!modalLayout?.blocks || modalLayout.blocks.length === 0) {
    return []
  }

  const fieldMap = new Map<string, TableField>()
  allFields.forEach((field) => {
    fieldMap.set(field.name, field)
    fieldMap.set(field.id, field)
  })

  const fieldLayout: FieldLayoutItem[] = []

  // Process blocks, preserving order from y position
  const blocksWithFields = modalLayout.blocks
    .filter((block) => block.fieldName)
    .sort((a, b) => (a.y || 0) - (b.y || 0))

  blocksWithFields.forEach((block, index) => {
    const fieldName = block.fieldName
    if (!fieldName) return

    const field = fieldMap.get(fieldName)
    if (!field) return

    fieldLayout.push({
      field_id: field.id,
      field_name: field.name,
      order: index,
      visible_in_modal: true,
      visible_in_canvas: false,
      visible_in_card: false,
      editable: true,
      group_name: field.group_name ?? undefined,
    })
  })

  return fieldLayout
}

/**
 * Convert modal_fields array to field_layout format
 * Used for backward compatibility with existing modal_fields config
 */
export function convertModalFieldsToFieldLayout(
  modalFields: string[],
  allFields: TableField[]
): FieldLayoutItem[] {
  if (!modalFields || modalFields.length === 0) {
    return []
  }

  const fieldMap = new Map<string, TableField>()
  allFields.forEach((field) => {
    fieldMap.set(field.name, field)
    fieldMap.set(field.id, field)
  })

  return modalFields.map((fieldName, index) => {
    const field = fieldMap.get(fieldName)
    if (!field) {
      // Field doesn't exist, create placeholder
      return {
        field_id: fieldName,
        field_name: fieldName,
        order: index,
        visible_in_modal: true,
        visible_in_canvas: false,
        visible_in_card: false,
        editable: true,
      }
    }

    return {
      field_id: field.id,
      field_name: field.name,
      order: index,
      visible_in_modal: true,
      visible_in_canvas: false,
      visible_in_card: false,
      editable: true,
      group_name: field.group_name ?? undefined,
    }
  })
}

/**
 * Get field groups from field_layout
 * Groups fields by group_name for RecordFields component
 */
export function getFieldGroupsFromLayout(
  fieldLayout: FieldLayoutItem[],
  allFields: TableField[]
): Record<string, string[]> {
  const groups: Record<string, string[]> = {}
  const DEFAULT_GROUP = 'General'

  if (!fieldLayout || fieldLayout.length === 0) {
    // If no field_layout, group by field.group_name
    allFields.forEach((field) => {
      const groupName = field.group_name || DEFAULT_GROUP
      if (!groups[groupName]) {
        groups[groupName] = []
      }
      groups[groupName].push(field.name)
    })
    return groups
  }

  // Create field map
  const fieldMap = new Map<string, TableField>()
  allFields.forEach((field) => {
    fieldMap.set(field.name, field)
    fieldMap.set(field.id, field)
  })

  // Group by group_name from layout
  fieldLayout
    .filter((item) => item.visible_in_modal !== false)
    .forEach((item) => {
      const field = fieldMap.get(item.field_name) || fieldMap.get(item.field_id)
      if (!field) return

      const groupName = item.group_name || field.group_name || DEFAULT_GROUP
      if (!groups[groupName]) {
        groups[groupName] = []
      }
      if (!groups[groupName].includes(field.name)) {
        groups[groupName].push(field.name)
      }
    })

  return groups
}
