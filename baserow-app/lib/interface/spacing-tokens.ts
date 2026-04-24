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
export const BLOCK_HEADER_PADDING = 'px-3 py-2'

/** Optional: standard gap between form fields or list items (for future use). */
export const FORM_FIELD_GAP = 'space-y-4'

/** App-level horizontal page padding for headers and action rows. */
export const APP_PAGE_PADDING_X = "px-4 md:px-6"

/** Standard compact vertical spacing for bars/headers. */
export const APP_BAR_PADDING_Y = "py-2.5"

/** Standard section gap used by page canvases. */
export const APP_SECTION_GAP = "gap-4 md:gap-6"

/** Unified panel shell radius utility. */
export const APP_PANEL_RADIUS = "rounded-card-lg"
