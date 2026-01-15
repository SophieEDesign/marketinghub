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

import type { FieldType, FieldOptions, ChoiceColorTheme } from '@/types/fields'

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
 * Fixed, user-selectable palettes for "pill" colours.
 * Note: `vibrant` intentionally maps to the existing behaviour (semantic/muted)
 * to keep backwards compatibility when no theme is selected.
 */
export const CHOICE_COLOR_THEME_LABELS: Record<ChoiceColorTheme, string> = {
  vibrant: 'Vibrant (default)',
  pastel: 'Pastel',
  blues: 'Blue variations',
}

export const CHOICE_COLOR_THEME_PALETTES: Record<
  Exclude<ChoiceColorTheme, 'vibrant'>,
  { single: readonly string[]; multi: readonly string[] }
> = {
  pastel: {
    // Tailwind-ish 200 range (soft, readable with dark text)
    single: [
      '#BFDBFE', // blue-200
      '#BBF7D0', // green-200
      '#FDE68A', // amber-200
      '#FECACA', // red-200
      '#DDD6FE', // violet-200
      '#FBCFE8', // pink-200
      '#A5F3FC', // cyan-200
      '#99F6E4', // teal-200
      '#FED7AA', // orange-200
      '#C7D2FE', // indigo-200
      '#D9F99D', // lime-200
      '#E9D5FF', // purple-200
    ],
    // Slightly lighter for multi-select where many pills can appear together
    multi: [
      '#DBEAFE', // blue-100
      '#DCFCE7', // green-100
      '#FEF3C7', // amber-100
      '#FEE2E2', // red-100
      '#EDE9FE', // violet-100
      '#FCE7F3', // pink-100
      '#CFFAFE', // cyan-100
      '#CCFBF1', // teal-100
      '#FFEDD5', // orange-100
      '#E0E7FF', // indigo-100
      '#ECFCCB', // lime-100
      '#F3E8FF', // purple-100
    ],
  },
  blues: {
    // Blue-only variants (useful for brand-aligned "all blue" tagging)
    single: [
      '#1D4ED8', // blue-700
      '#2563EB', // blue-600
      '#3B82F6', // blue-500
      '#60A5FA', // blue-400
      '#0EA5E9', // sky-500
      '#0284C7', // sky-600
      '#6366F1', // indigo-500
      '#4F46E5', // indigo-600
      '#06B6D4', // cyan-500
      '#0891B2', // cyan-600
      '#93C5FD', // blue-300
      '#A5B4FC', // indigo-300
    ],
    multi: [
      '#DBEAFE', // blue-100
      '#BFDBFE', // blue-200
      '#93C5FD', // blue-300
      '#CFFAFE', // cyan-100
      '#A5F3FC', // cyan-200
      '#E0E7FF', // indigo-100
      '#C7D2FE', // indigo-200
      '#E0F2FE', // sky-100
      '#BAE6FD', // sky-200
      '#D1FAE5', // green-100 (kept subtle contrast option)
      '#F1F5F9', // slate-100 (neutral)
      '#E2E8F0', // slate-200 (neutral)
    ],
  },
}

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
 * Get the palette that should be used for choice colour hashing/pickers.
 * - Respects `fieldOptions.choiceColorTheme` when present
 * - Otherwise uses the existing semantic/muted behaviour
 */
export function getChoiceThemePalette(
  fieldType: 'single_select' | 'multi_select',
  fieldOptions?: FieldOptions,
  useSemanticColors: boolean = true
): readonly string[] {
  const theme = fieldOptions?.choiceColorTheme
  if (theme && theme !== 'vibrant') {
    const palettes = CHOICE_COLOR_THEME_PALETTES[theme]
    return fieldType === 'single_select' ? palettes.single : palettes.multi
  }

  // Backwards-compatible default behaviour
  const palette = useSemanticColors
    ? (fieldType === 'single_select' ? SEMANTIC_COLORS : MUTED_COLORS)
    : MUTED_COLORS
  return palette
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
  const palette = getChoiceThemePalette(fieldType, fieldOptions, useSemanticColors)
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
