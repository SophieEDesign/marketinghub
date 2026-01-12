/**
 * DataViewService - Core data view operations for spreadsheet-style copy/paste/duplicate
 * 
 * This service is the source of truth for data mutations.
 * All views (grid, form, bulk editor) should use this service for consistency.
 */

import { createClient } from '@/lib/supabase/client'
import type { TableField } from '@/types/fields'
import type {
  Selection,
  CellChange,
  ValidationError,
  BatchMutationResult,
  PasteIntent,
  DuplicateColumnOptions,
  DataViewContext,
} from './types'
import { parseClipboardText, formatClipboardText, formatCellValue, parseCellValue } from './clipboard'
import { validateValue as validateFieldValue } from './validation'

export class DataViewService {
  private context: DataViewContext

  constructor(context: DataViewContext) {
    this.context = context
  }

  /**
   * Update context (e.g., when rows/fields change)
   */
  updateContext(context: Partial<DataViewContext>) {
    this.context = { ...this.context, ...context }
  }

  /**
   * Copy operation - format selection for clipboard
   */
  copy(selection: Selection): string {
    const { rows, fields, visibleFields } = this.context

    // Get visible fields in order (for row/column copy)
    const orderedFields = visibleFields || fields
    const fieldOrder = orderedFields
      .sort((a, b) => (a.order_index ?? a.position ?? 0) - (b.order_index ?? b.position ?? 0))
      .map(f => f.name)

    switch (selection.type) {
      case 'cell': {
        // Copy single cell value
        const row = rows.find(r => r.id === selection.rowId)
        if (!row) return ''
        const value = row[selection.fieldName]
        return formatCellValue(value)
      }

      case 'row': {
        // Copy row(s) as tab-separated values in visible column order
        const selectedRows = rows.filter(r => selection.rowIds.includes(r.id))
        const grid: string[][] = selectedRows.map(row =>
          fieldOrder.map(fieldName => formatCellValue(row[fieldName]))
        )
        return formatClipboardText(grid)
      }

      case 'column': {
        // Copy column as newline-separated values in row order
        const rowOrder = this.context.rowOrder || rows.map(r => r.id)
        const orderedRows = rowOrder
          .map(id => rows.find(r => r.id === id))
          .filter((r): r is typeof rows[0] => r !== undefined)

        const values = orderedRows.map(row => formatCellValue(row[selection.fieldName]))
        return values.join('\n')
      }
    }
  }

  /**
   * Resolve paste intent based on selection and clipboard data
   */
  resolvePasteIntent(
    selection: Selection,
    clipboardText: string
  ): PasteIntent | null {
    const { rows, fields } = this.context
    const grid = parseClipboardText(clipboardText)

    if (grid.length === 0) {
      return null
    }

    // Get visible fields in order
    const orderedFields = this.context.visibleFields || fields
    const fieldOrder = orderedFields
      .sort((a, b) => (a.order_index ?? a.position ?? 0) - (b.order_index ?? b.position ?? 0))
      .map(f => ({ id: f.id, name: f.name }))

    // Get row order
    const rowOrder = this.context.rowOrder || rows.map(r => r.id)
    const orderedRows = rowOrder
      .map(id => rows.find(r => r.id === id))
      .filter((r): r is typeof rows[0] => r !== undefined)

    switch (selection.type) {
      case 'column': {
        // Paste vertically into selected column
        const field = fields.find(f => f.id === selection.columnId || f.name === selection.fieldName)
        if (!field) return null

        const targetCells: Array<{ rowId: string; columnId: string; fieldName: string }> = []
        const firstRow = orderedRows[0]
        if (!firstRow) return null

        // Start from first row, paste one value per row
        orderedRows.forEach((row, index) => {
          if (index < grid.length && grid[index].length > 0 && grid[index][0].trim() !== '') {
            targetCells.push({
              rowId: row.id,
              columnId: field.id,
              fieldName: field.name,
            })
          }
        })

        return {
          targetCells,
          pasteMode: 'vertical',
        }
      }

      case 'row': {
        // Paste horizontally into selected row(s)
        const firstRowId = selection.rowIds[0]
        const firstRow = rows.find(r => r.id === firstRowId)
        if (!firstRow) return null

        const targetCells: Array<{ rowId: string; columnId: string; fieldName: string }> = []
        const firstRowData = grid[0] || []

        // Paste one value per column, starting from first visible field
        firstRowData.forEach((value, colIndex) => {
          if (colIndex < fieldOrder.length && value.trim() !== '') {
            const field = fieldOrder[colIndex]
            // Apply to all selected rows
            selection.rowIds.forEach(rowId => {
              targetCells.push({
                rowId,
                columnId: field.id,
                fieldName: field.name,
              })
            })
          }
        })

        return {
          targetCells,
          pasteMode: 'horizontal',
        }
      }

      case 'cell': {
        // Paste as 2D grid anchored at active cell
        const activeRow = rows.find(r => r.id === selection.rowId)
        const activeField = fields.find(f => f.id === selection.columnId || f.name === selection.fieldName)
        if (!activeRow || !activeField) return null

        const activeRowIndex = orderedRows.findIndex(r => r.id === selection.rowId)
        const activeColIndex = fieldOrder.findIndex(f => f.name === selection.fieldName)

        if (activeRowIndex === -1 || activeColIndex === -1) return null

        const targetCells: Array<{ rowId: string; columnId: string; fieldName: string }> = []

        // Paste grid starting from active cell
        grid.forEach((row, rowOffset) => {
          const targetRowIndex = activeRowIndex + rowOffset
          if (targetRowIndex >= orderedRows.length) return

          const targetRow = orderedRows[targetRowIndex]

          row.forEach((value, colOffset) => {
            const targetColIndex = activeColIndex + colOffset
            if (targetColIndex >= fieldOrder.length) return
            if (value.trim() === '') return // Skip empty cells

            const field = fieldOrder[targetColIndex]
            targetCells.push({
              rowId: targetRow.id,
              columnId: field.id,
              fieldName: field.name,
            })
          })
        })

        return {
          targetCells,
          pasteMode: 'grid',
        }
      }
    }
  }

  /**
   * Apply cell changes in a batch operation
   * Returns validation errors but doesn't abort on individual failures
   */
  async applyCellChanges(changes: CellChange[]): Promise<BatchMutationResult> {
    const { supabaseTableName, fields, rows } = this.context
    const supabase = createClient()

    const validatedChanges: CellChange[] = []
    const errors: ValidationError[] = []

    // Validate all changes first
    for (const change of changes) {
      const field = fields.find(f => f.id === change.columnId || f.name === change.fieldName)
      if (!field) {
        errors.push({
          rowId: change.rowId,
          columnId: change.columnId,
          fieldName: change.fieldName,
          value: change.value,
          error: `Field not found: ${change.fieldName}`,
        })
        continue
      }

      // Skip virtual fields
      if (field.type === 'formula' || field.type === 'lookup') {
        errors.push({
          rowId: change.rowId,
          columnId: change.columnId,
          fieldName: change.fieldName,
          value: change.value,
          error: `Field "${field.name}" is computed and cannot be edited`,
        })
        continue
      }

      // Parse and validate value
      const parsedValue = parseCellValue(change.value, field.type)
      const validation = validateFieldValue(field, parsedValue)

      if (!validation.valid) {
        errors.push({
          rowId: change.rowId,
          columnId: change.columnId,
          fieldName: change.fieldName,
          value: change.value,
          error: validation.error || 'Validation failed',
        })
        continue
      }

      // Store previous value for undo
      const row = rows.find(r => r.id === change.rowId)
      const previousValue = row ? row[change.fieldName] : undefined

      validatedChanges.push({
        ...change,
        value: validation.normalizedValue,
        previousValue,
      })
    }

    // Apply valid changes in batch
    const appliedCount = await this.applyBatchUpdates(supabase, supabaseTableName, validatedChanges)

    return {
      success: errors.length === 0,
      changes: validatedChanges,
      errors,
      appliedCount,
      errorCount: errors.length,
    }
  }

  /**
   * Apply batch updates to database
   */
  private async applyBatchUpdates(
    supabase: any,
    tableName: string,
    changes: CellChange[]
  ): Promise<number> {
    if (changes.length === 0) {
      return 0
    }

    // Group changes by row for efficient updates
    const changesByRow = new Map<string, Record<string, any>>()

    for (const change of changes) {
      if (!changesByRow.has(change.rowId)) {
        changesByRow.set(change.rowId, {})
      }
      const rowUpdates = changesByRow.get(change.rowId)!
      rowUpdates[change.fieldName] = change.value
    }

    // Update each row
    const updatePromises = Array.from(changesByRow.entries()).map(([rowId, updates]) =>
      supabase
        .from(tableName)
        .update(updates)
        .eq('id', rowId)
    )

    const results = await Promise.allSettled(updatePromises)
    
    // Count successful updates
    return results.filter(r => r.status === 'fulfilled').length
  }

  /**
   * Validate a single value against a field
   */
  validateValue(columnId: string, value: any): { valid: boolean; error?: string; normalizedValue?: any } {
    const field = this.context.fields.find(f => f.id === columnId)
    if (!field) {
      return {
        valid: false,
        error: `Field not found: ${columnId}`,
      }
    }

    const parsedValue = parseCellValue(value, field.type)
    const result = validateFieldValue(field, parsedValue)

    return {
      valid: result.valid,
      error: result.error,
      normalizedValue: result.normalizedValue,
    }
  }

  /**
   * Duplicate a column (schema operation)
   */
  async duplicateColumn(
    columnId: string,
    options: DuplicateColumnOptions = { withData: false }
  ): Promise<{ success: boolean; newColumnId?: string; error?: string }> {
    const { tableId, supabaseTableName, fields, rows } = this.context
    const supabase = createClient()

    // Find source field
    const sourceField = fields.find(f => f.id === columnId)
    if (!sourceField) {
      return {
        success: false,
        error: `Column not found: ${columnId}`,
      }
    }

    // Skip virtual fields
    if (sourceField.type === 'formula' || sourceField.type === 'lookup') {
      return {
        success: false,
        error: `Cannot duplicate computed field: ${sourceField.name}`,
      }
    }

    try {
      // Generate new field name
      const newName = options.newName || this.generateDuplicateFieldName(sourceField.name, fields)

      // Get max position/order_index
      const maxOrder = fields.reduce((max, f) => {
        const order = f.order_index ?? f.position ?? 0
        return Math.max(max, order)
      }, -1)

      const newPosition = options.position !== undefined ? options.position : maxOrder + 1

      // Create new field metadata
      const { data: newField, error: fieldError } = await supabase
        .from('table_fields')
        .insert([
          {
            table_id: tableId,
            name: newName,
            type: sourceField.type,
            position: newPosition,
            order_index: newPosition,
            required: sourceField.required || false,
            default_value: sourceField.default_value,
            options: sourceField.options || {},
            group_name: sourceField.group_name,
          },
        ])
        .select()
        .single()

      if (fieldError) {
        return {
          success: false,
          error: `Failed to create field: ${fieldError.message}`,
        }
      }

      // Add column to physical table (if not virtual)
      if (sourceField.type !== 'formula' && sourceField.type !== 'lookup') {
        // Get PostgreSQL type from field type
        const postgresType = this.getPostgresType(sourceField.type)

        const { error: alterError } = await supabase.rpc('execute_sql_safe', {
          sql_text: `ALTER TABLE ${supabaseTableName} ADD COLUMN "${newName}" ${postgresType}`,
        })

        if (alterError) {
          // Rollback: delete field metadata
          await supabase.from('table_fields').delete().eq('id', newField.id)
          return {
            success: false,
            error: `Failed to add column to table: ${alterError.message}`,
          }
        }
      }

      // Copy data if requested
      if (options.withData && rows.length > 0) {
        const updates = rows.map(row => ({
          id: row.id,
          [newName]: row[sourceField.name],
        }))

        // Update in batches
        const batchSize = 100
        for (let i = 0; i < updates.length; i += batchSize) {
          const batch = updates.slice(i, i + batchSize)
          const updatePromises = batch.map(({ id, ...updates }) =>
            supabase
              .from(supabaseTableName)
              .update(updates)
              .eq('id', id)
          )
          await Promise.all(updatePromises)
        }
      }

      return {
        success: true,
        newColumnId: newField.id,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to duplicate column',
      }
    }
  }

  /**
   * Generate a unique duplicate field name
   */
  private generateDuplicateFieldName(baseName: string, existingFields: TableField[]): string {
    const existingNames = new Set(existingFields.map(f => f.name.toLowerCase()))
    let counter = 1
    let candidate = `${baseName} Copy`

    while (existingNames.has(candidate.toLowerCase())) {
      candidate = `${baseName} Copy ${counter}`
      counter++
    }

    return candidate
  }

  /**
   * Get PostgreSQL type for a field type
   */
  private getPostgresType(fieldType: string): string {
    switch (fieldType) {
      case 'text':
      case 'long_text':
      case 'url':
      case 'email':
      case 'single_select':
        return 'TEXT'
      case 'number':
      case 'percent':
      case 'currency':
        return 'NUMERIC'
      case 'date':
        return 'TIMESTAMPTZ'
      case 'multi_select':
        return 'TEXT[]'
      case 'checkbox':
        return 'BOOLEAN'
      case 'attachment':
      case 'json':
        return 'JSONB'
      case 'link_to_table':
        return 'UUID'
      default:
        return 'TEXT'
    }
  }
}
