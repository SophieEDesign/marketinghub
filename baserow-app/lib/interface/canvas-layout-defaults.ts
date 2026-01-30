/**
 * Shared canvas layout defaults - unified across main Canvas, ModalCanvas, and ModalLayoutEditor.
 * Single shape: { cols, rowHeight, margin }.
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

export type CanvasLayoutSettings = {
  cols?: number
  rowHeight?: number
  margin?: [number, number]
}
