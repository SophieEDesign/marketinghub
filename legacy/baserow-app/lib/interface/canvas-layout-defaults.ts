/**
 * Shared canvas layout defaults - unified across main Canvas, ModalCanvas, and ModalLayoutEditor.
 * Single shape: { cols, rowHeight, margin }. Modal also shares min/max constraints so editor preview matches modal.
 */

export const CANVAS_LAYOUT_DEFAULTS = {
  cols: 12,
  rowHeight: 30,
  margin: [10, 10] as [number, number],
} as const

export const MODAL_CANVAS_LAYOUT_DEFAULTS = {
  cols: 8,
  rowHeight: 30,
  margin: [0, 0] as [number, number], // No gaps - blocks snap together
} as const

/** Layout item constraints for modal canvas - same in ModalCanvas and ModalLayoutEditor so preview matches modal. */
export const MODAL_CANVAS_LAYOUT_CONSTRAINTS = {
  minW: 2,
  minH: 2,
  maxW: 8, // matches modal cols
  maxH: 20,
} as const

export type CanvasLayoutSettings = {
  cols?: number
  rowHeight?: number
  margin?: [number, number]
}
