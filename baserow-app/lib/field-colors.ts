/**
 * Centralized Field Color System
 * 
 * This module defines the global color theme for field types and provides
 * a unified color resolution system that ensures consistency across all UI surfaces.
 * 
 * Color Resolution Precedence (CRITICAL - Must be enforced everywhere):
 * 1. Option-level color override (choiceColors[option])
 * 2. Field-level color override (fieldOptions.fieldColor)
 * 3. Global field-type default
 * 4. Neutral fallback
 */

import type { FieldType, FieldOptions } from '@/types/fields'

// ============================================================================
// Global Color Palettes
// ============================================================================

/**
 * Semantic colors for select/status fields (vibrant, accessible)
 * Used for single-select status indicators where color conveys meaning
 */
export const SEMANTIC_COLORS = [
  '#3B82F6', // Blue - informational
  '#10B981', // Green - success/positive
  '#F59E0B', // Amber - warning/caution
  '#EF4444', // Red - error/critical
  '#8B5CF6', // Purple - special
  '#6366F1', // Indigo - secondary info
  '#EC4899', // Pink - attention
  '#06B6D4', // Cyan - info
  '#14B8A6', // Teal - status
  '#F97316', // Orange - alert
  '#84CC16', // Lime - positive
  '#A855F7', // Violet - special
]

/**
 * Muted colors for multi-select tags (calmer, less saturated)
 * Used for tags where multiple colors appear together
 */
export const MUTED_COLORS = [
  '#94A3B8', // Slate (muted blue-gray)
  '#86EFAC', // Light green
  '#FCD34D', // Light amber
  '#FCA5A5', // Light red
  '#C4B5FD', // Light purple
  '#F9A8D4', // Light pink
  '#67E8F9', // Light cyan
  '#D9F99D', // Light lime
  '#FED7AA', // Light orange
  '#A5B4FC', // Light indigo
  '#5EEAD4', // Light teal
  '#C084FC', // Light violet
]

/**
 * Neutral colors for read-only/derived fields (muted grey tones)
 */
export const NEUTRAL_COLORS = [
  '#9CA3AF', // Gray 400
  '#6B7280', // Gray 500
  '#4B5563', // Gray 600
  '#374151', // Gray 700
]

/**
 * Linked record field default color (neutral blue)
 */
export const LINKED_RECORD_COLOR = '#3B82F6' // Blue

/**
 * Lookup field default color (muted grey, derived/read-only)
 */
export const LOOKUP_FIELD_COLOR = '#9CA3AF' // Gray 400

/**
 * Checkbox true color (success green)
 */
export const CHECKBOX_TRUE_COLOR = '#10B981' // Green

/**
 * Checkbox false color (neutral grey)
 */
export const CHECKBOX_FALSE_COLOR = '#9CA3AF' // Gray 400

// ============================================================================
// Color Resolution Functions
// ============================================================================

/**
 * Get a consistent color from a string using hash-based selection
 */
function getColorFromString(
  value: string,
  palette: readonly string[]
): string {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash)
  }
  return palette[Math.abs(hash) % palette.length]
}

/**
 * Resolve color for a select/multi-select choice with proper precedence
 * 
 * Precedence order:
 * 1. Option-level override (choiceColors[choice])
 * 2. Field-level override (fieldOptions.fieldColor)
 * 3. Global field-type default (semantic/muted based on field type)
 * 4. Neutral fallback
 */
export function resolveChoiceColor(
  choice: string,
  fieldType: 'single_select' | 'multi_select',
  fieldOptions?: FieldOptions,
  useSemanticColors: boolean = true
): string {
  // 1. Check option-level override (highest precedence)
  if (fieldOptions?.choiceColors?.[choice]) {
    return fieldOptions.choiceColors[choice]
  }

  // Try case-insensitive match for option-level override
  if (fieldOptions?.choiceColors) {
    const matchingKey = Object.keys(fieldOptions.choiceColors).find(
      key => key.toLowerCase() === choice.toLowerCase()
    )
    if (matchingKey) {
      return fieldOptions.choiceColors[matchingKey]
    }
  }

  // 2. Check field-level override
  if (fieldOptions?.fieldColor) {
    return fieldOptions.fieldColor
  }

  // 3. Global field-type default
  const palette = useSemanticColors 
    ? (fieldType === 'single_select' ? SEMANTIC_COLORS : MUTED_COLORS)
    : MUTED_COLORS
  return getColorFromString(choice, palette)
}

/**
 * Resolve color for a field value based on field type
 */
export function resolveFieldColor(
  fieldType: FieldType,
  value: any,
  fieldOptions?: FieldOptions
): string | null {
  // Select fields use choice-based colors
  if (fieldType === 'single_select' || fieldType === 'multi_select') {
    if (!value) return null
    if (fieldType === 'single_select') {
      return resolveChoiceColor(
        String(value),
        'single_select',
        fieldOptions,
        true // Use semantic colors for single-select
      )
    } else {
      // For multi-select, color is resolved per-choice
      return resolveChoiceColor(
        String(value),
        'multi_select',
        fieldOptions,
        false // Use muted colors for multi-select
      )
    }
  }

  // Linked record fields (neutral blue by default, can be overridden)
  if (fieldType === 'link_to_table') {
    return fieldOptions?.fieldColor || LINKED_RECORD_COLOR
  }

  // Lookup fields (muted grey, derived/read-only)
  if (fieldType === 'lookup') {
    return fieldOptions?.fieldColor || LOOKUP_FIELD_COLOR
  }

  // Checkbox fields (semantic green/grey)
  if (fieldType === 'checkbox') {
    return value ? CHECKBOX_TRUE_COLOR : CHECKBOX_FALSE_COLOR
  }

  // Text, number, date, etc. - no color (null means no color should be applied)
  return null
}

/**
 * Calculate appropriate text color (black or white) based on background color
 * Ensures WCAG contrast requirements are met
 */
export function getTextColorForBackground(hexColor: string): 'text-gray-900' | 'text-white' {
  try {
    // Remove # if present
    const hex = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor
    
    // Parse RGB
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return 'text-gray-900' // Safe fallback
    }
    
    // Calculate relative luminance (WCAG formula)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    
    // Use white text on dark backgrounds, black on light
    return luminance > 0.5 ? 'text-gray-900' : 'text-white'
  } catch {
    return 'text-gray-900' // Safe fallback
  }
}

/**
 * Format hex color ensuring it has # prefix
 */
export function normalizeHexColor(hexColor: string): string {
  if (!hexColor) return '#3B82F6' // Default blue fallback
  return hexColor.startsWith('#') ? hexColor : `#${hexColor}`
}

/**
 * Get all colors for a select field's choices
 * Returns a map of choice -> color for all choices in the field
 */
export function getAllChoiceColors(
  choices: string[],
  fieldType: 'single_select' | 'multi_select',
  fieldOptions?: FieldOptions
): Record<string, string> {
  const colors: Record<string, string> = {}
  
  for (const choice of choices) {
    colors[choice] = resolveChoiceColor(
      choice,
      fieldType,
      fieldOptions,
      fieldType === 'single_select'
    )
  }
  
  return colors
}

/**
 * Check if a field type should display with colors
 */
export function shouldDisplayWithColor(fieldType: FieldType): boolean {
  return [
    'single_select',
    'multi_select',
    'checkbox',
    'link_to_table',
    'lookup',
  ].includes(fieldType)
}

/**
 * Get a semantic color for a specific semantic meaning
 * Used for status fields where color has inherent meaning
 */
export function getSemanticColor(semantic: 'success' | 'warning' | 'error' | 'info'): string {
  switch (semantic) {
    case 'success':
      return SEMANTIC_COLORS[1] // Green
    case 'warning':
      return SEMANTIC_COLORS[2] // Amber
    case 'error':
      return SEMANTIC_COLORS[3] // Red
    case 'info':
      return SEMANTIC_COLORS[0] // Blue
    default:
      return SEMANTIC_COLORS[0]
  }
}
