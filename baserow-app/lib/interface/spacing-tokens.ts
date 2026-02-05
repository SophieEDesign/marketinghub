/**
 * Shared spacing/layout tokens for blocks and layout surfaces.
 * Use these in new code or when touching a component for other reasons;
 * do not bulk-replace existing Tailwind classes elsewhere.
 * Future layout convergence should use these tokens.
 *
 * Values match current behaviour (e.g. BlockAppearanceWrapper).
 */

/** Default padding for block content area (Tailwind class). */
export const BLOCK_CONTENT_PADDING = 'p-4'

/** Header bar horizontal and vertical padding (Tailwind classes). */
export const BLOCK_HEADER_PADDING = 'px-4 py-3'

/** Optional: standard gap between form fields or list items (for future use). */
export const FORM_FIELD_GAP = 'space-y-4'
