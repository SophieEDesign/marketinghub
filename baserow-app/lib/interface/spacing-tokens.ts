/**
 * Shared spacing/layout tokens — single source for blocks, panels, and density.
 */

export type SurfaceDensity = "comfortable" | "compact" | "tight"

/** Default padding for block content area */
export const BLOCK_CONTENT_PADDING = "p-3"

/** Header bar horizontal and vertical padding */
export const BLOCK_HEADER_PADDING = "px-3 py-1.5"

/** Standard gap between form fields or list items */
export const FORM_FIELD_GAP = "space-y-3"

/** App-level horizontal page padding */
export const APP_PAGE_PADDING_X = "px-4 md:px-6"

/** Compact vertical spacing for bars/headers */
export const APP_BAR_PADDING_Y = "py-2"

/** Section gap for dashboard/page layouts */
export const APP_SECTION_GAP = "gap-3 md:gap-4"

/** Primary card radius (16px) */
export const APP_CARD_RADIUS = "rounded-card"

/** Hero / feature panel radius (20px) */
export const APP_PANEL_RADIUS = "rounded-card-lg"

/** Inner nested UI radius (12px) */
export const APP_INNER_RADIUS = "rounded-inner"

/** Default card body padding */
export const CARD_PADDING = "p-3"

/** Compact card / list row padding */
export const CARD_PADDING_COMPACT = "px-3 py-2"

/** Panel section header padding */
export const PANEL_HEADER_PADDING = "px-3.5 py-2"

/** Vertical stack gap for list rows */
export const LIST_ROW_GAP = "space-y-1"

/** Dashboard page vertical rhythm */
export const DASHBOARD_PAGE_GAP = "gap-3 md:gap-4"

const DENSITY_CARD_PADDING: Record<SurfaceDensity, string> = {
  comfortable: "p-3.5",
  compact: "p-3",
  tight: "px-2.5 py-2",
}

const DENSITY_PANEL_HEADER: Record<SurfaceDensity, string> = {
  comfortable: "px-3.5 py-2.5",
  compact: "px-3.5 py-2",
  tight: "px-3 py-1.5",
}

const DENSITY_LIST_GAP: Record<SurfaceDensity, string> = {
  comfortable: "space-y-1.5",
  compact: "space-y-1",
  tight: "space-y-0.5",
}

export function densityCardPadding(density: SurfaceDensity = "compact"): string {
  return DENSITY_CARD_PADDING[density]
}

export function densityPanelHeader(density: SurfaceDensity = "compact"): string {
  return DENSITY_PANEL_HEADER[density]
}

export function densityListGap(density: SurfaceDensity = "compact"): string {
  return DENSITY_LIST_GAP[density]
}

/** Primary marketing surface (calendar hero, main focus). */
export const MARKETING_PANEL_PRIMARY =
  "rounded-card-lg border border-border/40 bg-card shadow-card ring-1 ring-border/20"

/** Secondary rail panels (sidebar lists). */
export const MARKETING_PANEL_SECONDARY =
  "rounded-lg border border-border/30 bg-muted/15 shadow-none"

/** Lightweight insight / gap callouts. */
export const MARKETING_INSIGHT_CARD =
  "rounded-lg border border-border/25 bg-muted/25 shadow-none"

/** Compact filter toolbar strip. */
export const MARKETING_FILTER_STRIP =
  "flex flex-wrap items-center gap-1.5 rounded-lg border border-border/25 bg-muted/10 px-2 py-1.5"
