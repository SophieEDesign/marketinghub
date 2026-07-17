/**
 * Central field label styling for the app.
 * All field titles (above inputs) should use these so they stay consistent.
 * Stored here so we can add customisation settings later (e.g. workspace/page-level
 * font size, weight, colour, spacing) without scattering overrides.
 *
 * Layout invariant: field blocks must never scroll; scroll ownership belongs to the
 * record container (modal/panel body) only. See docs/architecture/FIELD_SCROLL_INVARIANT.md.
 */

/** Tailwind classes for a field label: small, bold, above the input. */
export const FIELD_LABEL_CLASS =
  "block text-xs font-semibold text-gray-800 mb-1.5"

/** Same as FIELD_LABEL_CLASS but for use in a flex/gap context (use space-y-1.5 on parent instead of mb-1.5). */
export const FIELD_LABEL_CLASS_NO_MARGIN = "block text-xs font-semibold text-gray-800"

/** Container gap when label is above the field. */
export const FIELD_LABEL_GAP_CLASS = "space-y-1.5"
