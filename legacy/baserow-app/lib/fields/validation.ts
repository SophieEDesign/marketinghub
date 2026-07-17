import type { FieldType, FieldOptions } from '@/types/fields'
import { FIELD_TYPES, RESERVED_WORDS } from '@/types/fields'

const FIELD_TYPE_LABELS: Partial<Record<FieldType, string>> = Object.fromEntries(
  FIELD_TYPES.map((t) => [t.type, t.label])
) as Partial<Record<FieldType, string>>

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
 * Format field name for display (converts snake_case to Title Case)
 * Example: "social_media" -> "Social Media"
 */
export function formatFieldNameForDisplay(name: string): string {
  if (!name) return ''
  
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
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
      const label = FIELD_TYPE_LABELS[fieldType] || fieldType
      return { valid: false, error: `${label} requires options to be configured` }
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
      // Allow saving without linked_table_id for initial setup
      // The actual data conversion will require linked_table_id, but we allow saving field settings
      // This enables the workflow: change type → select table → save → convert data
      // Note: The API route will require linked_table_id when actually converting data
      break

    case 'lookup':
      // Allow saving without lookup_field_id for initial setup
      // The actual conversion will require lookup_table_id, but we allow saving field settings
      // This enables the workflow: change type → select table → auto-configure → save
      // Note: Full validation (checking that lookup_field_id is a valid linked field) 
      // is done server-side in the API route where we have access to table fields
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

  // Text to date - data may not be compatible
  if (oldType === 'text' && newType === 'date') {
    return { 
      canChange: true, 
      warning: 'Changing from text to date: existing data will not be automatically converted. Only metadata and UI will update. Invalid date values will display as empty.' 
    }
  }

  // Text to number - data may not be compatible
  if (oldType === 'text' && newType === 'number') {
    return { 
      canChange: true, 
      warning: 'Changing from text to number: existing data will not be automatically converted. Only metadata and UI will update. Invalid number values will display as empty.' 
    }
  }

  // Text to checkbox - data may not be compatible
  if (oldType === 'text' && newType === 'checkbox') {
    return { 
      canChange: true, 
      warning: 'Changing from text to checkbox: existing data will not be automatically converted. Only metadata and UI will update.' 
    }
  }

  // Date to text - format loss
  if (oldType === 'date' && newType === 'text') {
    return { 
      canChange: true, 
      warning: 'Changing from date to text: date formatting will be lost. Data will be converted to ISO string format.' 
    }
  }

  // Number to text - precision may be lost
  if (oldType === 'number' && newType === 'text') {
    return { 
      canChange: true, 
      warning: 'Changing from number to text: numeric precision will be lost.' 
    }
  }

  // Text/Select to linked field - will attempt to match by primary field
  if ((oldType === 'text' || oldType === 'single_select' || oldType === 'multi_select') && newType === 'link_to_table') {
    return { 
      canChange: true, 
      warning: 'Changing to linked field: existing text/select values will be matched to records in the linked table by title. Unmatched values will be left empty and highlighted as errors.' 
    }
  }

  // Text/Select to lookup field - will auto-configure lookup based on existing data
  if ((oldType === 'text' || oldType === 'single_select' || oldType === 'multi_select') && newType === 'lookup') {
    return { 
      canChange: true, 
      warning: 'Changing to lookup field: the system will attempt to auto-configure the lookup by finding or creating a linked field to match your existing data. You may need to manually configure the lookup relationship after conversion.' 
    }
  }

  return { canChange: true }
}
