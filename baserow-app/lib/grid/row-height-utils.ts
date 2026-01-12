/**
 * Row height utilities for grid views
 * Maps row height settings to pixel values matching Airtable-style behavior
 */

export type RowHeightOption = 'compact' | 'standard' | 'comfortable' | 'medium'

// Row height constants (matching AirtableGridView)
export const ROW_HEIGHT_COMPACT = 32
export const ROW_HEIGHT_STANDARD = 40
export const ROW_HEIGHT_COMFORTABLE = 56

// Legacy support: 'medium' maps to 'standard'
const ROW_HEIGHT_MEDIUM = 40

/**
 * Convert row height string to pixel value
 * @param height - Row height setting ('compact', 'standard', 'comfortable', or 'medium')
 * @returns Pixel height value
 */
export function getRowHeightPixels(height?: string | null): number {
  if (!height) return ROW_HEIGHT_STANDARD
  
  const normalized = height.toLowerCase()
  
  switch (normalized) {
    case 'compact':
      return ROW_HEIGHT_COMPACT
    case 'standard':
    case 'medium': // Legacy support
      return ROW_HEIGHT_STANDARD
    case 'comfortable':
      return ROW_HEIGHT_COMFORTABLE
    default:
      return ROW_HEIGHT_STANDARD
  }
}

/**
 * Normalize row height value (convert 'medium' to 'standard' for consistency)
 * @param height - Row height setting
 * @returns Normalized row height value
 */
export function normalizeRowHeight(height?: string | null): RowHeightOption {
  if (!height) return 'standard'
  
  const normalized = height.toLowerCase()
  
  if (normalized === 'medium') {
    return 'standard'
  }
  
  if (['compact', 'standard', 'comfortable'].includes(normalized)) {
    return normalized as RowHeightOption
  }
  
  return 'standard'
}
