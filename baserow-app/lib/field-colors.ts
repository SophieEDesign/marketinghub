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
  heatmap: 'Heat Map',
  cool: 'Cool Tones',
  earth: 'Earth Tones',
  sunset: 'Sunset',
  ocean: 'Ocean',
  forest: 'Forest',
  grayscale: 'Grayscale',
  rainbow: 'Rainbow',
}

export function isChoiceColorTheme(value: unknown): value is ChoiceColorTheme {
  return typeof value === 'string' && [
    'vibrant', 'pastel', 'blues', 'heatmap', 'cool', 'earth', 
    'sunset', 'ocean', 'forest', 'grayscale', 'rainbow'
  ].includes(value)
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
  heatmap: {
    // Warm colors from yellow through orange to red (heat map style)
    single: [
      '#FEF3C7', // yellow-100
      '#FDE68A', // amber-200
      '#FCD34D', // amber-300
      '#FBBF24', // amber-400
      '#F59E0B', // amber-500
      '#F97316', // orange-500
      '#FB923C', // orange-400
      '#FDBA74', // orange-300
      '#EF4444', // red-500
      '#F87171', // red-400
      '#FCA5A5', // red-300
      '#DC2626', // red-600
    ],
    multi: [
      '#FFFBEB', // amber-50
      '#FEF3C7', // amber-100
      '#FDE68A', // amber-200
      '#FED7AA', // orange-200
      '#FEE2E2', // red-100
      '#FECACA', // red-200
      '#FFF7ED', // orange-50
      '#FFEDD5', // orange-100
      '#FEF9C3', // yellow-100
      '#FEF3C7', // amber-100
      '#FEE2E2', // red-100
      '#FECACA', // red-200
    ],
  },
  cool: {
    // Cool tones: greens, teals, cyans, cool blues
    single: [
      '#10B981', // green-500
      '#059669', // green-600
      '#34D399', // green-400
      '#14B8A6', // teal-500
      '#0D9488', // teal-600
      '#2DD4BF', // teal-400
      '#06B6D4', // cyan-500
      '#0891B2', // cyan-600
      '#22D3EE', // cyan-400
      '#0EA5E9', // sky-500
      '#0284C7', // sky-600
      '#38BDF8', // sky-400
    ],
    multi: [
      '#D1FAE5', // green-100
      '#A7F3D0', // green-200
      '#6EE7B7', // green-300
      '#CCFBF1', // teal-100
      '#99F6E4', // teal-200
      '#5EEAD4', // teal-300
      '#CFFAFE', // cyan-100
      '#A5F3FC', // cyan-200
      '#67E8F9', // cyan-300
      '#E0F2FE', // sky-100
      '#BAE6FD', // sky-200
      '#7DD3FC', // sky-300
    ],
  },
  earth: {
    // Earth tones: browns, tans, beiges, warm grays
    single: [
      '#92400E', // amber-800
      '#B45309', // amber-700
      '#D97706', // amber-600
      '#F59E0B', // amber-500
      '#78716C', // stone-600
      '#57534E', // stone-700
      '#44403C', // stone-800
      '#A16207', // yellow-700
      '#CA8A04', // yellow-600
      '#EAB308', // yellow-500
      '#713F12', // amber-900
      '#854D0E', // amber-800
    ],
    multi: [
      '#FEF3C7', // amber-100
      '#FDE68A', // amber-200
      '#FCD34D', // amber-300
      '#F5F5F4', // stone-100
      '#E7E5E4', // stone-200
      '#D6D3D1', // stone-300
      '#FEF9C3', // yellow-100
      '#FEF08A', // yellow-200
      '#FDE047', // yellow-300
      '#FEF3C7', // amber-100
      '#FED7AA', // orange-200
      '#FECACA', // red-200
    ],
  },
  sunset: {
    // Sunset colors: oranges, pinks, purples, magentas
    single: [
      '#F97316', // orange-500
      '#FB923C', // orange-400
      '#F87171', // red-400
      '#EC4899', // pink-500
      '#F472B6', // pink-400
      '#A855F7', // violet-500
      '#C084FC', // violet-400
      '#9333EA', // violet-600
      '#DB2777', // pink-600
      '#EA580C', // orange-600
      '#DC2626', // red-600
      '#BE185D', // pink-700
    ],
    multi: [
      '#FFEDD5', // orange-100
      '#FED7AA', // orange-200
      '#FEE2E2', // red-100
      '#FCE7F3', // pink-100
      '#FBCFE8', // pink-200
      '#F3E8FF', // violet-100
      '#E9D5FF', // violet-200
      '#FDF2F8', // pink-50
      '#FFF7ED', // orange-50
      '#FEF2F2', // red-50
      '#FAF5FF', // violet-50
      '#FDF4FF', // fuchsia-50
    ],
  },
  ocean: {
    // Ocean colors: deep blues, teals, cyans
    single: [
      '#0C4A6E', // sky-900
      '#075985', // sky-800
      '#0369A1', // sky-700
      '#0284C7', // sky-600
      '#0EA5E9', // sky-500
      '#0891B2', // cyan-600
      '#06B6D4', // cyan-500
      '#0D9488', // teal-600
      '#14B8A6', // teal-500
      '#155E75', // cyan-800
      '#164E63', // cyan-900
      '#134E4A', // teal-800
    ],
    multi: [
      '#E0F2FE', // sky-100
      '#BAE6FD', // sky-200
      '#7DD3FC', // sky-300
      '#CFFAFE', // cyan-100
      '#A5F3FC', // cyan-200
      '#67E8F9', // cyan-300
      '#CCFBF1', // teal-100
      '#99F6E4', // teal-200
      '#5EEAD4', // teal-300
      '#F0F9FF', // sky-50
      '#ECFEFF', // cyan-50
      '#F0FDFA', // teal-50
    ],
  },
  forest: {
    // Forest colors: various greens, browns, deep teals
    single: [
      '#14532D', // green-900
      '#166534', // green-800
      '#15803D', // green-700
      '#16A34A', // green-600
      '#22C55E', // green-500
      '#0D9488', // teal-600
      '#14B8A6', // teal-500
      '#365314', // lime-800
      '#4B5563', // gray-600
      '#57534E', // stone-700
      '#059669', // green-600
      '#10B981', // green-500
    ],
    multi: [
      '#F0FDF4', // green-50
      '#DCFCE7', // green-100
      '#BBF7D0', // green-200
      '#86EFAC', // green-300
      '#F0FDFA', // teal-50
      '#CCFBF1', // teal-100
      '#99F6E4', // teal-200
      '#5EEAD4', // teal-300
      '#F7FEE7', // lime-50
      '#ECFCCB', // lime-100
      '#D9F99D', // lime-200
      '#BEF264', // lime-300
    ],
  },
  grayscale: {
    // Grayscale: various shades of gray
    single: [
      '#111827', // gray-900
      '#1F2937', // gray-800
      '#374151', // gray-700
      '#4B5563', // gray-600
      '#6B7280', // gray-500
      '#9CA3AF', // gray-400
      '#D1D5DB', // gray-300
      '#E5E7EB', // gray-200
      '#F3F4F6', // gray-100
      '#F9FAFB', // gray-50
      '#000000', // black
      '#FFFFFF', // white (with border)
    ],
    multi: [
      '#F9FAFB', // gray-50
      '#F3F4F6', // gray-100
      '#E5E7EB', // gray-200
      '#D1D5DB', // gray-300
      '#9CA3AF', // gray-400
      '#6B7280', // gray-500
      '#4B5563', // gray-600
      '#374151', // gray-700
      '#1F2937', // gray-800
      '#111827', // gray-900
      '#F9FAFB', // gray-50
      '#E5E7EB', // gray-200
    ],
  },
  rainbow: {
    // Rainbow: full spectrum of colors
    single: [
      '#EF4444', // red-500
      '#F97316', // orange-500
      '#FBBF24', // amber-400
      '#EAB308', // yellow-500
      '#84CC16', // lime-500
      '#22C55E', // green-500
      '#10B981', // green-500
      '#14B8A6', // teal-500
      '#06B6D4', // cyan-500
      '#3B82F6', // blue-500
      '#6366F1', // indigo-500
      '#8B5CF6', // violet-500
      '#A855F7', // violet-500
      '#EC4899', // pink-500
    ],
    multi: [
      '#FEE2E2', // red-100
      '#FED7AA', // orange-200
      '#FDE68A', // amber-200
      '#FEF08A', // yellow-200
      '#D9F99D', // lime-200
      '#BBF7D0', // green-200
      '#A7F3D0', // green-200
      '#99F6E4', // teal-200
      '#A5F3FC', // cyan-200
      '#BFDBFE', // blue-200
      '#C7D2FE', // indigo-200
      '#DDD6FE', // violet-200
      '#E9D5FF', // violet-200
      '#FBCFE8', // pink-200
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
  // Defensive: DB might contain unexpected string values.
  const themeUnknown: unknown = fieldOptions?.choiceColorTheme
  if (isChoiceColorTheme(themeUnknown) && themeUnknown !== 'vibrant') {
    const palettes = CHOICE_COLOR_THEME_PALETTES[themeUnknown]
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
  const normalizedChoice = String(choice || '').trim()

  // 0. Canonical option model: selectOptions (preferred)
  // Records typically store the option *label* (string), but some older data might store IDs.
  // If we have explicit colors on options, use them as the highest-precedence source.
  const selectOptions = Array.isArray(fieldOptions?.selectOptions) ? fieldOptions?.selectOptions : undefined
  if (selectOptions && normalizedChoice) {
    const match = selectOptions.find((opt) => {
      const label = String(opt?.label ?? '').trim()
      const id = String(opt?.id ?? '').trim()
      if (!label && !id) return false
      const c = normalizedChoice.toLowerCase()
      return (label && label.toLowerCase() === c) || (id && id.toLowerCase() === c)
    })

    const rawColor = String(match?.color ?? '').trim()
    if (rawColor) {
      // Only accept hex-like colors here; downstream code expects hex for alpha suffixing.
      // If it's not hex, ignore and fall through to other sources.
      const hexLike = rawColor.startsWith('#')
        ? rawColor.slice(1)
        : rawColor
      if (/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hexLike)) {
        return rawColor.startsWith('#') ? rawColor : `#${rawColor}`
      }
    }
  }

  // 1. Check option-level override (highest precedence)
  if (normalizedChoice && fieldOptions?.choiceColors?.[normalizedChoice]) {
    return fieldOptions.choiceColors[normalizedChoice]
  }

  // Try case-insensitive match for option-level override
  if (fieldOptions?.choiceColors) {
    const matchingKey = Object.keys(fieldOptions.choiceColors).find(
      key => key.toLowerCase() === normalizedChoice.toLowerCase()
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
  return getColorFromString(normalizedChoice || choice, palette)
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
