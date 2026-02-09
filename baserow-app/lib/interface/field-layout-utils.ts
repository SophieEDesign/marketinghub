/**
 * Field Layout Utilities
 * 
 * Helper functions for converting between old field configuration formats
 * (visible_fields, editable_fields, modal_fields, card_fields) and the
 * new unified field_layout format.
 */

import type { PageConfig } from './page-config'
import type { TableField } from '@/types/fields'

export interface FieldLayoutItem {
  field_id: string
  field_name: string
  order: number
  visible_in_modal?: boolean
  visible_in_card?: boolean
  visible_in_canvas?: boolean
  editable: boolean
  group_name?: string
}

/**
 * Convert old config format to field_layout format
 * Supports backward compatibility with:
 * - visible_fields / detail_fields
 * - editable_fields
 * - modal_fields (from block config)
 * - card_fields (from block config)
 */
export function convertToFieldLayout(
  config: PageConfig | any,
  allFields: TableField[],
  blockConfig?: any
): FieldLayoutItem[] {
  const fieldLayout: FieldLayoutItem[] = []
  const fieldMap = new Map<string, TableField>()
  
  // Create field map for quick lookup
  allFields.forEach((field) => {
    fieldMap.set(field.name, field)
    fieldMap.set(field.id, field)
  })

  // Get field names from various config sources
  const visibleFields = config.visible_fields || config.detail_fields || []
  const editableFields = config.editable_fields || []
  const modalFields = blockConfig?.modal_fields || config.modal_fields || []
  const cardFields = blockConfig?.card_fields || config.card_fields || []

  // If no explicit config, show all fields
  const fieldsToProcess = visibleFields.length > 0 
    ? visibleFields 
    : allFields.map(f => f.name)

  // Build field layout
  fieldsToProcess.forEach((fieldName: string, index: number) => {
    const field = fieldMap.get(fieldName)
    if (!field) return

    const isEditable = editableFields.length === 0 
      ? true // If no editable_fields list, all fields are editable
      : editableFields.includes(fieldName)

    const layoutItem: FieldLayoutItem = {
      field_id: field.id,
      field_name: field.name,
      order: index,
      visible_in_canvas: true,
      visible_in_modal: modalFields.length === 0 || modalFields.includes(fieldName),
      visible_in_card: cardFields.length === 0 || cardFields.includes(fieldName),
      editable: isEditable,
      group_name: field.group_name,
    }

    fieldLayout.push(layoutItem)
  })

  // Add any fields that exist in modal_fields or card_fields but not in visible_fields
  const processedFieldNames = new Set(fieldsToProcess)
  
  ;[...new Set([...modalFields, ...cardFields])].forEach((fieldName: string) => {
    if (processedFieldNames.has(fieldName)) return
    
    const field = fieldMap.get(fieldName)
    if (!field) return

    const isEditable = editableFields.length === 0 
      ? true 
      : editableFields.includes(fieldName)

    fieldLayout.push({
      field_id: field.id,
      field_name: field.name,
      order: fieldLayout.length,
      visible_in_canvas: false,
      visible_in_modal: modalFields.includes(fieldName),
      visible_in_card: cardFields.includes(fieldName),
      editable: isEditable,
      group_name: field.group_name,
    })
  })

  return fieldLayout
}

/**
 * Convert field_layout back to old config format (for backward compatibility)
 */
export function convertFromFieldLayout(
  fieldLayout: FieldLayoutItem[]
): {
  visible_fields: string[]
  editable_fields: string[]
  modal_fields?: string[]
  card_fields?: string[]
} {
  const visibleFields = fieldLayout
    .filter(item => item.visible_in_canvas !== false)
    .sort((a, b) => a.order - b.order)
    .map(item => item.field_name)

  const editableFields = fieldLayout
    .filter(item => item.editable && item.visible_in_canvas !== false)
    .map(item => item.field_name)

  const modalFields = fieldLayout
    .filter(item => item.visible_in_modal !== false)
    .map(item => item.field_name)

  const cardFields = fieldLayout
    .filter(item => item.visible_in_card !== false)
    .map(item => item.field_name)

  return {
    visible_fields: visibleFields,
    editable_fields: editableFields,
    modal_fields: modalFields.length > 0 ? modalFields : undefined,
    card_fields: cardFields.length > 0 ? cardFields : undefined,
  }
}
