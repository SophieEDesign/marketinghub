/**
 * Field Settings API
 * 
 * Single source of truth for reading and writing field settings.
 * All field editing components should use these functions instead of
 * directly accessing Supabase.
 */

import { createClient } from '@/lib/supabase/client'
import type { TableField, FieldOptions, SelectOption, FieldType } from '@/types/fields'
import type { CanonicalFieldSettings, FieldSettingsUpdate, ValidationResult } from './types'
import { normalizeSelectOptionsForUi } from '@/lib/fields/select-options'
import { getFieldDisplayName } from '@/lib/fields/display'

/**
 * Get field settings from core data
 * 
 * This is the single source of truth for reading field settings.
 * All components should use this instead of directly querying Supabase.
 */
export async function getFieldSettings(fieldId: string): Promise<CanonicalFieldSettings | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('table_fields')
    .select('*')
    .eq('id', fieldId)
    .single()
  
  if (error || !data) {
    console.error('Error loading field settings:', error)
    return null
  }
  
  const field = data as TableField
  
  return {
    id: field.id,
    name: field.name,
    label: field.label,
    type: field.type,
    required: field.required || false,
    read_only: field.options?.read_only || false,
    default_value: field.default_value,
    group_name: field.group_name,
    options: field.options || {},
    position: field.position,
    order_index: field.order_index,
    created_at: field.created_at,
    updated_at: field.updated_at,
  }
}

/**
 * Update field settings in core data
 * 
 * This is the single source of truth for writing field settings.
 * All components should use this instead of directly updating Supabase.
 * 
 * The function handles:
 * - Normalizing options (especially select field options)
 * - Validating settings
 * - Preserving existing values when not specified
 */
export async function updateFieldSettings(
  fieldId: string,
  updates: FieldSettingsUpdate
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  
  // Get current field to preserve values
  const current = await getFieldSettings(fieldId)
  if (!current) {
    return { success: false, error: 'Field not found' }
  }
  
  // Validate updates
  const validation = validateFieldSettings(updates, current.type)
  if (!validation.valid) {
    return { success: false, error: validation.errors.join(', ') }
  }
  
  // Prepare update payload
  const updatePayload: any = {}
  
  // Update label if provided
  if (updates.label !== undefined) {
    updatePayload.label = updates.label?.trim() || null
  }
  
  // Update type if provided (with validation)
  if (updates.type !== undefined && updates.type !== current.type) {
    updatePayload.type = updates.type
  }
  
  // Update required if provided
  if (updates.required !== undefined) {
    updatePayload.required = updates.required
  }
  
  // Update group_name if provided
  if (updates.group_name !== undefined) {
    updatePayload.group_name = updates.group_name?.trim() || null
  }
  
  // Update default_value if provided
  if (updates.default_value !== undefined) {
    updatePayload.default_value = updates.default_value
  }
  
  // Update options if provided
  if (updates.options !== undefined) {
    const normalizedOptions = normalizeFieldOptions(updates.options, updates.type || current.type)
    
    // Handle read_only flag (stored in options)
    if (updates.read_only !== undefined) {
      if (updates.read_only) {
        normalizedOptions.read_only = true
      } else {
        delete normalizedOptions.read_only
      }
    } else if (current.read_only && !normalizedOptions.read_only) {
      // Preserve existing read_only if not explicitly updated
      normalizedOptions.read_only = true
    }
    
    updatePayload.options = normalizedOptions
  } else if (updates.read_only !== undefined) {
    // Update read_only in existing options
    const currentOptions = current.options || {}
    if (updates.read_only) {
      currentOptions.read_only = true
    } else {
      delete currentOptions.read_only
    }
    updatePayload.options = currentOptions
  }
  
  // Execute update
  const { error } = await supabase
    .from('table_fields')
    .update(updatePayload)
    .eq('id', fieldId)
  
  if (error) {
    console.error('Error updating field settings:', error)
    return { success: false, error: error.message }
  }
  
  return { success: true }
}

/**
 * Validate field settings
 * 
 * Centralized validation logic for field settings.
 */
export function validateFieldSettings(
  settings: Partial<CanonicalFieldSettings>,
  fieldType?: FieldType
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Validate name/label
  if (settings.label !== undefined && settings.label !== null) {
    const trimmed = settings.label.trim()
    if (trimmed.length === 0) {
      errors.push('Field label cannot be empty')
    }
  }
  
  // Validate type-specific options
  if (settings.options && fieldType) {
    if ((fieldType === 'single_select' || fieldType === 'multi_select')) {
      const { selectOptions } = normalizeSelectOptionsForUi(fieldType, settings.options)
      if (selectOptions.length === 0) {
        warnings.push('Select fields should have at least one option')
      }
    }
    
    if (fieldType === 'formula' && !settings.options.formula) {
      warnings.push('Formula fields should have a formula expression')
    }
    
    if (fieldType === 'lookup') {
      if (!settings.options.lookup_table_id) {
        errors.push('Lookup fields require a lookup_table_id')
      }
      if (!settings.options.lookup_field_id) {
        errors.push('Lookup fields require a lookup_field_id')
      }
    }
    
    if (fieldType === 'link_to_table') {
      if (!settings.options.linked_table_id) {
        errors.push('Link fields require a linked_table_id')
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Normalize field options
 * 
 * Centralized normalization logic for field options.
 * This ensures options are in the correct format before saving.
 */
export function normalizeFieldOptions(
  options: FieldOptions,
  fieldType: FieldType
): FieldOptions {
  let normalized: FieldOptions = { ...options }
  
  // Normalize select field options
  if (fieldType === 'single_select' || fieldType === 'multi_select') {
    const normalizedResult = normalizeSelectOptionsForUi(fieldType, normalized)
    if (normalizedResult.repairedFieldOptions) {
      normalized = normalizedResult.repairedFieldOptions
    }
    
    // Ensure selectOptions are properly ordered
    const { selectOptions } = normalizeSelectOptionsForUi(fieldType, normalized)
    if (selectOptions.length > 0) {
      // Sync choices and choiceColors with selectOptions
      const choices = selectOptions.map(o => o.label)
      const choiceColors: Record<string, string> = {}
      
      for (const option of selectOptions) {
        if (option.color) {
          choiceColors[option.label] = option.color
        }
      }
      
      normalized.selectOptions = selectOptions
      normalized.choices = choices
      if (Object.keys(choiceColors).length > 0) {
        normalized.choiceColors = choiceColors
      } else {
        delete normalized.choiceColors
      }
    }
    
    // Filter out empty choices
    if (normalized.choices) {
      normalized.choices = normalized.choices.filter(c => c.trim() !== '')
      if (normalized.choices.length === 0) {
        delete normalized.choices
      }
    }
  }
  
  // Remove undefined/null values (but preserve valid falsy values)
  Object.keys(normalized).forEach(key => {
    const value = normalized[key as keyof FieldOptions]
    if (value === undefined || value === null || 
        (Array.isArray(value) && value.length === 0 && key !== 'lookup_filters')) {
      delete normalized[key as keyof FieldOptions]
    }
  })
  
  return normalized
}

/**
 * Get field display name
 * 
 * Helper to get the display name for a field (label or formatted name).
 */
export function getFieldDisplayNameFromSettings(settings: CanonicalFieldSettings): string {
  return getFieldDisplayName({
    name: settings.name,
    label: settings.label,
  } as TableField)
}

/**
 * Check if field supports pills
 * 
 * Determines if a field type supports pill/tag rendering.
 */
export function fieldSupportsPills(fieldType: FieldType): boolean {
  return ['single_select', 'multi_select', 'link_to_table'].includes(fieldType)
}

/**
 * Get default visibility for a field
 * 
 * Determines the default visibility state for a field.
 */
export function getDefaultFieldVisibility(fieldType: FieldType): 'visible' | 'hidden' | 'conditional' {
  // System fields are typically hidden
  // For now, all fields default to visible
  return 'visible'
}
