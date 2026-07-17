/**
 * Shared Linked Field Configuration Utility
 * 
 * This utility creates LookupFieldConfig from field options, ensuring
 * consistent behavior across Grid blocks and Field blocks.
 * 
 * Core data (table_fields.options) is the single source of truth for
 * all linked field configuration.
 */

import type { TableField } from '@/types/fields'
import type { LookupFieldConfig } from '@/components/fields/LookupFieldPicker'

/**
 * Creates a LookupFieldConfig from a linked field definition.
 * 
 * This function extracts all linked field configuration from core data
 * (field.options) and creates a standardized config object that can be
 * used by both Grid blocks (LinkedRecordCell) and Field blocks (FieldBlock).
 * 
 * @param field - The linked field definition from table_fields
 * @returns LookupFieldConfig or undefined if field is not a linked field
 */
export function createLookupFieldConfig(field: TableField): LookupFieldConfig | undefined {
  // Only process link_to_table fields
  if (field.type !== 'link_to_table') {
    return undefined
  }

  const linkedTableId = field.options?.linked_table_id
  if (!linkedTableId) {
    return undefined
  }

  return {
    lookupTableId: linkedTableId,
    primaryLabelField: field.options?.primary_label_field,
    secondaryLabelFields: field.options?.secondary_label_fields,
    relationshipType: field.options?.relationship_type || 'one-to-many',
    maxSelections: field.options?.max_selections,
    required: field.required,
    allowCreate: field.options?.allow_create,
  }
}
