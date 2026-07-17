/**
 * Value validation by field type
 */

import type { TableField, FieldType, LinkedField } from '@/types/fields'
import { isLinkedField, isLookupField } from '@/types/fields'
import { resolvePastedLinkedValue } from './linkedFields'

export interface ValidationResult {
  valid: boolean
  error?: string
  normalizedValue?: any
}

/**
 * Validate a value against a field definition
 */
export function validateValue(field: TableField, value: any): ValidationResult {
  // Null/empty values
  if (value === null || value === undefined || value === '') {
    if (field.required) {
      return {
        valid: false,
        error: `Field "${field.name}" is required`,
      }
    }
    return { valid: true, normalizedValue: null }
  }

  // Type-specific validation
  switch (field.type) {
    case 'text':
    case 'long_text':
    case 'url':
    case 'email':
      return validateText(field, value)

    case 'number':
    case 'percent':
    case 'currency':
      return validateNumber(field, value)

    case 'date':
      return validateDate(field, value)

    case 'single_select':
      return validateSingleSelect(field, value)

    case 'multi_select':
      return validateMultiSelect(field, value)

    case 'checkbox':
      return validateCheckbox(field, value)

    case 'link_to_table':
      // Linked fields require async resolution for pasted text
      // This is handled in DataViewService.applyCellChanges with a special case
      return validateLinkToTable(field, value)

    case 'attachment':
      return validateAttachment(field, value)

    case 'json':
      return validateJson(field, value)

    case 'formula':
    case 'lookup':
      // Virtual fields are read-only
      return {
        valid: false,
        error: `Field "${field.name}" is a computed field and cannot be edited`,
      }

    default:
      return { valid: true, normalizedValue: value }
  }
}

function validateText(field: TableField, value: any): ValidationResult {
  const str = String(value)
  
  // Email validation
  if (field.type === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(str)) {
      return {
        valid: false,
        error: `Invalid email format for "${field.name}"`,
      }
    }
  }

  // URL validation
  if (field.type === 'url') {
    try {
      new URL(str)
    } catch {
      return {
        valid: false,
        error: `Invalid URL format for "${field.name}"`,
      }
    }
  }

  return { valid: true, normalizedValue: str }
}

function validateNumber(field: TableField, value: any): ValidationResult {
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  
  if (isNaN(num)) {
    return {
      valid: false,
      error: `Invalid number for "${field.name}"`,
    }
  }

  // Apply precision if specified
  const precision = field.options?.precision
  const normalized = precision !== undefined ? parseFloat(num.toFixed(precision)) : num

  return { valid: true, normalizedValue: normalized }
}

function validateDate(field: TableField, value: any): ValidationResult {
  let date: Date

  if (value instanceof Date) {
    date = value
  } else if (typeof value === 'string') {
    date = new Date(value)
  } else if (typeof value === 'number') {
    date = new Date(value)
  } else {
    return {
      valid: false,
      error: `Invalid date format for "${field.name}"`,
    }
  }

  if (isNaN(date.getTime())) {
    return {
      valid: false,
      error: `Invalid date format for "${field.name}"`,
    }
  }

  return { valid: true, normalizedValue: date.toISOString() }
}

function validateSingleSelect(field: TableField, value: any): ValidationResult {
  const choices = field.options?.choices || []
  
  if (choices.length === 0) {
    return { valid: true, normalizedValue: String(value) }
  }

  const strValue = String(value)
  if (!choices.includes(strValue)) {
    return {
      valid: false,
      error: `Value "${strValue}" is not a valid choice for "${field.name}". Valid choices: ${choices.join(', ')}`,
    }
  }

  return { valid: true, normalizedValue: strValue }
}

function validateMultiSelect(field: TableField, value: any): ValidationResult {
  const choices = field.options?.choices || []
  
  // Ensure value is an array
  const arr = Array.isArray(value) ? value : [value].filter(v => v !== null && v !== undefined)
  
  if (choices.length === 0) {
    return { valid: true, normalizedValue: arr }
  }

  // Validate each choice
  const invalid = arr.filter(v => !choices.includes(String(v)))
  if (invalid.length > 0) {
    return {
      valid: false,
      error: `Invalid choices for "${field.name}": ${invalid.join(', ')}. Valid choices: ${choices.join(', ')}`,
    }
  }

  // Remove duplicates
  const unique = Array.from(new Set(arr.map(v => String(v))))

  return { valid: true, normalizedValue: unique }
}

function validateCheckbox(field: TableField, value: any): ValidationResult {
  // Accept boolean or truthy/falsy values
  const bool = value === true || value === 'true' || value === 1 || value === '1' || value === 'yes'
  return { valid: true, normalizedValue: bool }
}

function validateLinkToTable(field: TableField, value: any): ValidationResult {
  // If value is already a UUID (string), validate it
  if (typeof value === 'string') {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(value)) {
      return { valid: true, normalizedValue: value }
    }
  }

  // If value is an array of UUIDs (multi-link)
  if (Array.isArray(value)) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const allValid = value.every(v => typeof v === 'string' && uuidRegex.test(v))
    if (allValid) {
      return { valid: true, normalizedValue: value }
    }
  }

  // If value is a string but not a UUID, it might be a display name
  // This will be resolved in DataViewService.applyCellChanges
  // For now, we return invalid to trigger the async resolution
  return {
    valid: false,
    error: `Invalid value for "${field.name}". Expected record ID or display name.`,
  }
}

/**
 * Validate and resolve a pasted linked field value
 * 
 * This is called from DataViewService when pasting into a linked field.
 * It attempts to resolve display names to record IDs.
 * 
 * @param field - Linked field definition
 * @param pastedValue - Pasted text (display name or ID)
 * @returns Validation result with resolved IDs
 */
export async function validatePastedLinkedValue(
  field: LinkedField,
  pastedValue: string
): Promise<ValidationResult> {
  const result = await resolvePastedLinkedValue(field, pastedValue)

  if (result.errors.length > 0) {
    return {
      valid: false,
      error: result.errors.join('; '),
    }
  }

  if (!result.ids) {
    return {
      valid: false,
      error: `Could not resolve "${pastedValue}" to a record in the target table`,
    }
  }

  return {
    valid: true,
    normalizedValue: result.ids,
  }
}

function validateAttachment(field: TableField, value: any): ValidationResult {
  // Accept JSONB object or array of objects
  if (typeof value === 'object' && value !== null) {
    return { valid: true, normalizedValue: value }
  }

  // Try to parse as JSON
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return { valid: true, normalizedValue: parsed }
    } catch {
      return {
        valid: false,
        error: `Invalid attachment format for "${field.name}"`,
      }
    }
  }

  return {
    valid: false,
    error: `Invalid attachment format for "${field.name}"`,
  }
}

function validateJson(field: TableField, value: any): ValidationResult {
  // Accept objects directly
  if (typeof value === 'object' && value !== null) {
    return { valid: true, normalizedValue: value }
  }

  // Try to parse as JSON
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return { valid: true, normalizedValue: parsed }
    } catch {
      return {
        valid: false,
        error: `Invalid JSON for "${field.name}"`,
      }
    }
  }

  return {
    valid: false,
    error: `Invalid JSON format for "${field.name}"`,
  }
}
