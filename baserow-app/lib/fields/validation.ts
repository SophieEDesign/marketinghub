import type { FieldType, FieldOptions } from '@/types/fields'
import { RESERVED_WORDS } from '@/types/fields'

/**
 * Sanitize field name for database use
 */
export function sanitizeFieldName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 63) // PostgreSQL identifier limit
}

/**
 * Validate field name
 */
export function validateFieldName(name: string, existingNames: string[]): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Field name is required' }
  }

  const sanitized = sanitizeFieldName(name)
  
  if (sanitized.length === 0) {
    return { valid: false, error: 'Field name must contain at least one alphanumeric character' }
  }

  if (RESERVED_WORDS.includes(sanitized.toLowerCase())) {
    return { valid: false, error: `"${sanitized}" is a reserved word and cannot be used as a field name` }
  }

  if (existingNames.includes(sanitized)) {
    return { valid: false, error: `A field with the name "${sanitized}" already exists` }
  }

  return { valid: true }
}

/**
 * Validate field options based on type
 */
export function validateFieldOptions(
  fieldType: FieldType,
  options?: FieldOptions
): { valid: boolean; error?: string } {
  if (!options) {
    if (fieldType === 'single_select' || fieldType === 'multi_select' || fieldType === 'link_to_table' || fieldType === 'lookup') {
      return { valid: false, error: `${fieldType} requires options to be configured` }
    }
    return { valid: true }
  }

  switch (fieldType) {
    case 'single_select':
    case 'multi_select':
      if (!options.choices || options.choices.length === 0) {
        return { valid: false, error: 'Select fields must have at least one choice' }
      }
      break

    case 'link_to_table':
      if (!options.linked_table_id) {
        return { valid: false, error: 'Link field must specify a linked table' }
      }
      break

    case 'lookup':
      if (!options.lookup_table_id || !options.lookup_field_id) {
        return { valid: false, error: 'Lookup field must specify lookup table and field' }
      }
      break

    case 'formula':
      if (!options.formula || options.formula.trim().length === 0) {
        return { valid: false, error: 'Formula field must have a formula expression' }
      }
      break
  }

  return { valid: true }
}

/**
 * Check if type change is safe
 */
export function canChangeType(
  oldType: FieldType,
  newType: FieldType
): { canChange: boolean; warning?: string } {
  // Virtual fields can't be changed to/from
  if (oldType === 'formula' || oldType === 'lookup') {
    if (newType !== 'formula' && newType !== 'lookup') {
      return { canChange: false, warning: 'Cannot change virtual field to physical field' }
    }
  }

  if (newType === 'formula' || newType === 'lookup') {
    if (oldType !== 'formula' && oldType !== 'lookup') {
      return { canChange: false, warning: 'Cannot change physical field to virtual field. Delete and recreate instead.' }
    }
  }

  // Array to non-array is destructive
  if (oldType === 'multi_select' && newType !== 'multi_select') {
    return { canChange: true, warning: 'Changing from multi-select to single value may lose data' }
  }

  // Non-array to array might fail
  if (newType === 'multi_select' && oldType !== 'multi_select') {
    return { canChange: true, warning: 'Changing to multi-select may require data migration' }
  }

  return { canChange: true }
}
