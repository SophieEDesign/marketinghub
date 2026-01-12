/**
 * Core data view types for spreadsheet-style operations
 */

import type { TableField, FieldType } from '@/types/fields'

/**
 * Selection types - only one can be active at a time
 */
export type SelectionType = 'cell' | 'row' | 'column'

/**
 * Cell selection - single active cell
 */
export interface CellSelection {
  type: 'cell'
  rowId: string
  columnId: string
  fieldName: string
}

/**
 * Row selection - entire row(s)
 */
export interface RowSelection {
  type: 'row'
  rowIds: string[]
}

/**
 * Column selection - entire column
 */
export interface ColumnSelection {
  type: 'column'
  columnId: string
  fieldName: string
}

export type Selection = CellSelection | RowSelection | ColumnSelection

/**
 * Cell change - represents a single cell update
 */
export interface CellChange {
  rowId: string
  columnId: string
  fieldName: string
  value: any
  previousValue?: any
}

/**
 * Validation error for a cell change
 */
export interface ValidationError {
  rowId: string
  columnId: string
  fieldName: string
  value: any
  error: string
}

/**
 * Batch mutation result
 */
export interface BatchMutationResult {
  success: boolean
  changes: CellChange[]
  errors: ValidationError[]
  appliedCount: number
  errorCount: number
}

/**
 * Paste intent resolution result
 */
export interface PasteIntent {
  targetCells: Array<{ rowId: string; columnId: string; fieldName: string }>
  pasteMode: 'vertical' | 'horizontal' | 'grid'
}

/**
 * Column duplication options
 */
export interface DuplicateColumnOptions {
  withData: boolean // Copy existing row values
  newName?: string // Optional new name (auto-generated if not provided)
  position?: number // Optional position (appended if not provided)
}

/**
 * Data view context - required for operations
 */
export interface DataViewContext {
  tableId: string
  supabaseTableName: string
  rows: Array<{ id: string; [key: string]: any }>
  fields: TableField[]
  visibleFields?: TableField[] // Fields visible in current view (for copy)
  rowOrder?: string[] // Explicit row order (if available)
}
