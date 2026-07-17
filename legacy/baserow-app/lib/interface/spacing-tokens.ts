/**
 * Shared spacing/layout tokens — single source for blocks, panels, and density.
 *
 * SURFACE_TOKEN_CONTRACT (canonical — do not add parallel radius/shadow stacks):
 * | Role            | Radius              | Shadow                          | CSS class        |
 * |-----------------|---------------------|---------------------------------|------------------|
 * | Card            | rounded-card        | shadow-card (+ hover utility)   | .surface-card    |
 * | Panel           | rounded-card-lg     | shadow-card                     | .panel-shell     |
 * | Hero / elevated | rounded-card-lg     | shadow-elevated                 | .surface-elevated|
 * | Inner nested    | rounded-inner       | none                            | —                |
 *
 * --section-gap (globals) applies under .marketing-dashboard-shell only.
 * APP_SECTION_GAP is the React/Tailwind rhythm for dashboard grids.
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
  "rounded-inner border border-border/30 bg-muted/15 shadow-none"

/** Edit-mode block frame — builder chrome only (view mode uses transparent wrapper). */
export const BUILDER_CHROME_FRAME_BASE =
  "group bg-card border-2 border-dashed border-border/60 hover:border-border rounded-card shadow-card hover:shadow-card-hover"

export const BUILDER_CHROME_FRAME_SELECTED =
  "ring-2 ring-accent-link/50 border-accent-link/60 shadow-elevated"

export const BUILDER_CHROME_FRAME_SNAP =
  "ring-2 ring-accent-link/35 border-accent-link/40 shadow-card-hover"

export const BUILDER_CHROME_FRAME_KEYBOARD =
  "ring-2 ring-chart-2/50 border-chart-2/40 shadow-elevated"

export const BUILDER_CHROME_FRAME_VIEW =
  "bg-transparent border-0 shadow-none"

export const BUILDER_CHROME_DRAG_HANDLE =
  "p-1.5 bg-card/95 backdrop-blur-sm border border-border rounded-inner shadow-card hover:border-accent-link/50 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-link/40 focus-visible:ring-offset-2"

/** Lightweight insight / gap callouts. */
export const MARKETING_INSIGHT_CARD =
  "rounded-lg border border-border/25 bg-muted/25 shadow-none"

/** Compact filter toolbar strip. */
export const MARKETING_FILTER_STRIP =
  "flex flex-wrap items-center gap-1.5 rounded-lg border border-border/25 bg-muted/10 px-2 py-1.5"
