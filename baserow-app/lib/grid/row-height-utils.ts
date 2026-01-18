/**
 * Row height utilities for grid views
 * Maps row height settings to pixel values matching Airtable-style behavior
 */

export type RowHeightOption = 'compact' | 'standard' | 'large' | 'extra_large'
export type LegacyRowHeightOption =
  | RowHeightOption
  | 'comfortable'
  | 'medium'
  | 'short'
  | 'tall'

// Row height constants (matching AirtableGridView)
export const ROW_HEIGHT_COMPACT = 32
export const ROW_HEIGHT_STANDARD = 40
export const ROW_HEIGHT_LARGE = 56
export const ROW_HEIGHT_EXTRA_LARGE = 88
// Total vertical padding (top + bottom) used by text cells.
export const ROW_HEIGHT_CONTENT_PADDING = 8
export const DEFAULT_TEXT_LINE_HEIGHT = 20

/**
 * Convert row height string to pixel value
 * @param height - Row height setting ('compact', 'standard', 'comfortable', or 'medium')
 * @returns Pixel height value
 */
export function getRowHeightPixels(height?: string | null): number {
  const normalized = normalizeRowHeight(height)

  switch (normalized) {
    case 'compact':
      return ROW_HEIGHT_COMPACT
    case 'large':
      return ROW_HEIGHT_LARGE
    case 'extra_large':
      return ROW_HEIGHT_EXTRA_LARGE
    case 'standard':
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

  const normalized = height.toLowerCase().replace(/\s+/g, '_')

  switch (normalized) {
    case 'compact':
    case 'short':
      return 'compact'
    case 'standard':
    case 'medium':
      return 'standard'
    case 'large':
    case 'comfortable':
    case 'tall':
      return 'large'
    case 'extra_large':
    case 'extra-large':
      return 'extra_large'
    default:
      return 'standard'
  }
}

/**
 * Calculate content height inside a row (accounts for padding).
 */
export function getRowHeightContentHeight(
  rowHeight?: number | null,
  paddingPx: number = ROW_HEIGHT_CONTENT_PADDING
): number | undefined {
  if (!rowHeight) return undefined
  return Math.max(16, rowHeight - paddingPx)
}

/**
 * Determine the number of text lines that fit in a row.
 */
export function getRowHeightLineClamp(
  rowHeight?: number | null,
  options: {
    lineHeightPx?: number
    paddingPx?: number
    minLines?: number
    maxLines?: number
  } = {}
): number | undefined {
  if (!rowHeight) return undefined
  const {
    lineHeightPx = DEFAULT_TEXT_LINE_HEIGHT,
    paddingPx = ROW_HEIGHT_CONTENT_PADDING,
    minLines = 1,
    maxLines,
  } = options

  const contentHeight = getRowHeightContentHeight(rowHeight, paddingPx)
  if (!contentHeight) return minLines
  const rawLines = Math.floor(contentHeight / lineHeightPx)
  const clamped = Math.max(minLines, rawLines)
  return typeof maxLines === 'number' ? Math.min(maxLines, clamped) : clamped
}

/**
 * Determine the text clamp lines for grid text cells.
 * When wrapText is disabled, always clamp to a single line.
 */
export function getRowHeightTextLineClamp(
  rowHeight?: number | null,
  options: {
    wrapText?: boolean
    lineHeightPx?: number
    paddingPx?: number
  } = {}
): number | undefined {
  const {
    wrapText = false,
    lineHeightPx = DEFAULT_TEXT_LINE_HEIGHT,
    paddingPx = ROW_HEIGHT_CONTENT_PADDING,
  } = options

  if (!wrapText) return 1
  return getRowHeightLineClamp(rowHeight, { lineHeightPx, paddingPx })
}
