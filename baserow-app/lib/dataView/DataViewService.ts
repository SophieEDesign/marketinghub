/**
 * DataViewService - Core data view operations for spreadsheet-style copy/paste/duplicate
 * 
 * This service is the source of truth for data mutations.
 * All views (grid, form, bulk editor) should use this service for consistency.
 */

import { createClient, type SupabaseClient } from '@/lib/supabase/client'
import type { ReturnType } from '@/lib/supabase/client'
import type { TableField, FieldType } from '@/types/fields'
import { isLinkedField, isLookupField } from '@/types/fields'
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
import { validateValue as validateFieldValue, validatePastedLinkedValue } from './validation'
import { resolveLinkedFieldDisplay } from './linkedFields'

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
   * 
   * For linked fields, uses display labels (comma-separated for multi-link).
   * For lookup fields, copies computed display values (read-only).
   * 
   * Note: This is synchronous and returns IDs for linked fields if async resolution
   * is needed. In practice, linked field display values should be pre-resolved
   * in the view layer before calling copy().
   */
  copy(selection: Selection): string {
    const { rows, fields, visibleFields } = this.context

    // Get visible fields in order (for row/column copy)
    const orderedFields = visibleFields || fields
    const fieldOrder = orderedFields
      .sort((a, b) => (a.order_index ?? a.position ?? 0) - (b.order_index ?? b.position ?? 0))
      .map(f => ({ name: f.name, field: f }))

    switch (selection.type) {
      case 'cell': {
        // Copy single cell value
        const row = rows.find(r => r.id === selection.rowId)
        if (!row) return ''
        const field = fields.find(f => f.name === selection.fieldName)
        const value = row[selection.fieldName]
        
        // For linked fields, format with field context
        return formatCellValue(value, field)
      }

      case 'row': {
        // Copy row(s) as tab-separated values in visible column order
        const selectedRows = rows.filter(r => selection.rowIds.includes(r.id))
        const grid: string[][] = selectedRows.map(row =>
          fieldOrder.map(({ name, field }) => formatCellValue(row[name], field))
        )
        return formatClipboardText(grid)
      }

      case 'column': {
        // Copy column as newline-separated values in row order
        const rowOrder = this.context.rowOrder || rows.map(r => r.id)
        const orderedRows = rowOrder
          .map(id => rows.find(r => r.id === id))
          .filter((r): r is typeof rows[0] => r !== undefined)

        const field = fields.find(f => f.name === selection.fieldName)
        const values = orderedRows.map(row => formatCellValue(row[selection.fieldName], field))
        return values.join('\n')
      }
    }
  }

  /**
   * Copy operation with async display resolution for linked fields
   * 
   * This version resolves linked field IDs to display labels before copying.
   * Use this when you need display names in the clipboard.
   */
  async copyWithDisplayResolution(selection: Selection): Promise<string> {
    const { rows, fields, visibleFields } = this.context

    // Get visible fields in order (for row/column copy)
    const orderedFields = visibleFields || fields
    const fieldOrder = orderedFields
      .sort((a, b) => (a.order_index ?? a.position ?? 0) - (b.order_index ?? b.position ?? 0))
      .map(f => ({ name: f.name, field: f }))

    switch (selection.type) {
      case 'cell': {
        // Copy single cell value
        const row = rows.find(r => r.id === selection.rowId)
        if (!row) return ''
        const field = fields.find(f => f.name === selection.fieldName)
        const value = row[selection.fieldName]
        
        // Resolve linked field display if needed
        if (field && isLinkedField(field) && value) {
          const display = await resolveLinkedFieldDisplay(field, value)
          return display
        }
        
        return formatCellValue(value, field)
      }

      case 'row': {
        // Copy row(s) as tab-separated values in visible column order
        const selectedRows = rows.filter(r => selection.rowIds.includes(r.id))
        const grid: string[][] = []
        
        for (const row of selectedRows) {
          const rowValues: string[] = []
          for (const { name, field } of fieldOrder) {
            const value = row[name]
            
            // Resolve linked field display if needed
            if (field && isLinkedField(field) && value) {
              const display = await resolveLinkedFieldDisplay(field, value)
              rowValues.push(display)
            } else {
              rowValues.push(formatCellValue(value, field))
            }
          }
          grid.push(rowValues)
        }
        
        return formatClipboardText(grid)
      }

      case 'column': {
        // Copy column as newline-separated values in row order
        const rowOrder = this.context.rowOrder || rows.map(r => r.id)
        const orderedRows = rowOrder
          .map(id => rows.find(r => r.id === id))
          .filter((r): r is typeof rows[0] => r !== undefined)

        const field = fields.find(f => f.name === selection.fieldName)
        const values: string[] = []
        
        for (const row of orderedRows) {
          const value = row[selection.fieldName]
          
          // Resolve linked field display if needed
          if (field && isLinkedField(field) && value) {
            const display = await resolveLinkedFieldDisplay(field, value)
            values.push(display)
          } else {
            values.push(formatCellValue(value, field))
          }
        }
        
        return values.join('\n')
      }
    }
  }

  /**
   * Resolve paste intent based on selection and clipboard data
   * 
   * @param selection - Current selection (cell/row/column)
   * @param clipboardText - Clipboard text to paste
   * @param options - Optional configuration
   * @param options.maxRows - Maximum rows to paste (default: 10000)
   * @param options.maxCols - Maximum columns to paste (default: 1000)
   */
  resolvePasteIntent(
    selection: Selection,
    clipboardText: string,
    options: { maxRows?: number; maxCols?: number } = {}
  ): PasteIntent | null {
    const { rows, fields } = this.context
    const { maxRows = 10000, maxCols = 1000 } = options
    const grid = parseClipboardText(clipboardText)
    const warnings: string[] = []

    if (grid.length === 0) {
      return null
    }

    // Guardrail: Check paste size
    const rowCount = grid.length
    const colCount = Math.max(...grid.map(row => row.length), 0)
    
    if (rowCount > maxRows) {
      const warning = `[DataViewService] Paste size exceeds max rows: ${rowCount} > ${maxRows}. Truncating.`
      console.warn(warning)
      warnings.push(warning)
      // Truncate to max rows
      grid.splice(maxRows)
    }
    
    if (colCount > maxCols) {
      const warning = `[DataViewService] Paste size exceeds max columns: ${colCount} > ${maxCols}. Truncating.`
      console.warn(warning)
      warnings.push(warning)
      // Truncate each row to max columns
      grid.forEach(row => {
        if (row.length > maxCols) {
          row.splice(maxCols)
        }
      })
    }

    // Soft warning for large pastes
    if (rowCount * colCount > 1000) {
      const warning = `[DataViewService] Large paste detected: ${rowCount} rows × ${colCount} columns = ${rowCount * colCount} cells`
      console.warn(warning)
      warnings.push(warning)
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

        // Reject paste into lookup fields
        if (isLookupField(field)) {
          return {
            targetCells: [],
            pasteMode: 'vertical',
            warnings: [
              `Cannot paste into lookup field "${field.name}" (read-only)`,
              ...warnings,
            ],
          }
        }

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
          warnings: warnings.length > 0 ? warnings : undefined,
        }
      }

      case 'row': {
        // Paste horizontally into selected row(s)
        const firstRowId = selection.rowIds[0]
        const firstRow = rows.find(r => r.id === firstRowId)
        if (!firstRow) return null

        const targetCells: Array<{ rowId: string; columnId: string; fieldName: string }> = []
        const firstRowData = grid[0] || []
        const skippedLookups: string[] = []

        // Paste one value per column, starting from first visible field
        firstRowData.forEach((value, colIndex) => {
          if (colIndex < fieldOrder.length && value.trim() !== '') {
            const field = fieldOrder[colIndex]
            const targetField = fields.find(f => f.id === field.id || f.name === field.name)
            
            // Skip lookup fields
            if (targetField && isLookupField(targetField)) {
              if (!skippedLookups.includes(targetField.name)) {
                skippedLookups.push(targetField.name)
              }
              return
            }

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

        const allWarnings = [
          ...warnings,
          ...(skippedLookups.length > 0 
            ? [`Skipped ${skippedLookups.length} lookup field(s): ${skippedLookups.join(', ')} (read-only)`]
            : []
          ),
        ]

        return {
          targetCells,
          pasteMode: 'horizontal',
          warnings: allWarnings.length > 0 ? allWarnings : undefined,
        }
      }

      case 'cell': {
        // Paste as 2D grid anchored at active cell
        const activeRow = rows.find(r => r.id === selection.rowId)
        const activeField = fields.find(f => f.id === selection.columnId || f.name === selection.fieldName)
        if (!activeRow || !activeField) return null

        // Reject paste into lookup fields
        if (isLookupField(activeField)) {
          return {
            targetCells: [],
            pasteMode: 'grid',
            warnings: [
              `Cannot paste into lookup field "${activeField.name}" (read-only)`,
              ...warnings,
            ],
          }
        }

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
            const targetField = fields.find(f => f.id === field.id || f.name === field.name)
            
            // Skip lookup fields
            if (targetField && isLookupField(targetField)) {
              return
            }

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
          warnings: warnings.length > 0 ? warnings : undefined,
        }
      }
    }
  }

  /**
   * Apply cell changes in a batch operation
   * Returns validation errors but doesn't abort on individual failures
   * 
   * @param changes - Array of cell changes to apply
   * @param options - Optional configuration
   * @param options.dryRun - If true, validate but don't persist changes
   * @param options.maxChanges - Maximum number of changes allowed (default: 10000)
   */
  async applyCellChanges(
    changes: CellChange[],
    options: { dryRun?: boolean; maxChanges?: number } = {}
  ): Promise<BatchMutationResult> {
    const { dryRun = false, maxChanges = 10000 } = options

    // Guardrail: Check max changes
    if (changes.length > maxChanges) {
      return {
        success: false,
        changes: [],
        errors: [
          {
            rowId: '',
            columnId: '',
            fieldName: '',
            value: null,
            error: `Too many changes (${changes.length}). Maximum allowed: ${maxChanges}`,
          },
        ],
        appliedCount: 0,
        errorCount: 1,
      }
    }
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

      // Reject lookup fields (read-only, computed)
      if (isLookupField(field)) {
        errors.push({
          rowId: change.rowId,
          columnId: change.columnId,
          fieldName: change.fieldName,
          value: change.value,
          error: `Field "${field.name}" is a lookup field (read-only) and cannot be edited`,
        })
        continue
      }

      // Reject formula fields (read-only, computed)
      if (field.type === 'formula') {
        errors.push({
          rowId: change.rowId,
          columnId: change.columnId,
          fieldName: change.fieldName,
          value: change.value,
          error: `Field "${field.name}" is a formula field (read-only) and cannot be edited`,
        })
        continue
      }

      // Special handling for linked fields: resolve pasted text to IDs
      let parsedValue = parseCellValue(change.value, field.type, field)
      
      if (isLinkedField(field) && typeof parsedValue === 'string' && parsedValue.trim()) {
        // Check if it's already a UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(parsedValue)) {
          // Not a UUID - try to resolve as display name
          const resolution = await validatePastedLinkedValue(field, parsedValue)
          if (!resolution.valid) {
            errors.push({
              rowId: change.rowId,
              columnId: change.columnId,
              fieldName: change.fieldName,
              value: change.value,
              error: resolution.error || `Could not resolve "${parsedValue}" to a record in the target table`,
            })
            continue
          }
          parsedValue = resolution.normalizedValue
        }
      }

      // Validate value
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

    // Apply valid changes in batch (unless dry run)
    const appliedCount = dryRun ? 0 : await this.applyBatchUpdates(supabase, supabaseTableName, validatedChanges)

    return {
      success: errors.length === 0,
      changes: validatedChanges,
      errors,
      appliedCount: dryRun ? validatedChanges.length : appliedCount,
      errorCount: errors.length,
    }
  }

  /**
   * Apply batch updates to database
   */
  private async applyBatchUpdates(
    supabase: ReturnType<typeof createClient>,
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
  validateValue(columnId: string, value: unknown): { valid: boolean; error?: string; normalizedValue?: unknown } {
    const field = this.context.fields.find(f => f.id === columnId)
    if (!field) {
      return {
        valid: false,
        error: `Field not found: ${columnId}`,
      }
    }

    const parsedValue = parseCellValue(value, field.type, field)
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

    // Skip formula fields (read-only, computed)
    if (sourceField.type === 'formula') {
      return {
        success: false,
        error: `Cannot duplicate formula field "${sourceField.name}" (read-only, computed)`,
      }
    }

    // Lookup fields: allow duplicate definition only (no data copy)
    // Note: This is allowed because users expect to duplicate column "structure" even if computed
    // The value will recompute automatically
    // "Duplicate with data" is not applicable for lookup fields
    const isLookup = isLookupField(sourceField)
    if (isLookup) {
      if (options.withData) {
        // Warn but allow - only copy definition
        // This matches Airtable behavior where you can duplicate lookup field definition
        console.warn(
          `[duplicateColumn] Lookup field "${sourceField.name}" values are computed. Only duplicating field definition.`
        )
      }
      // Continue to duplicate definition (schema only)
    }

    // TypeScript: At this point, we know it's not 'formula' (we returned above)
    // For lookup fields, we continue but skip data copy later
    // We need to check if it's a virtual field type to determine if we should add a physical column
    // Only lookup fields are virtual at this point (formula fields already returned)
    const isVirtualFieldType = isLookup

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
      // Linked fields are stored (not virtual), so they need a physical column
      // TypeScript: We know it's not 'formula' (we returned early), and isVirtualFieldType checks for 'lookup'
      if (!isVirtualFieldType) {
        // Get PostgreSQL type from field type
        // At this point, TypeScript knows it's not 'formula' (returned above)
        // and !isVirtualFieldType means it's not 'lookup' either
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
      // For linked fields, copy the linked values (IDs)
      // For lookup fields, skip data copy (values are computed, not stored)
      // Note: Lookup field duplication is allowed above, but we skip data copy here
      // TypeScript: We know it's not 'formula' (we returned early), so only check isLookup
      const isVirtualFieldForData = isLookup
      if (options.withData && rows.length > 0 && !isVirtualFieldForData) {
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
    } catch (error: unknown) {
      const errorMessage = (error as { message?: string })?.message || 'Failed to duplicate column'
      return {
        success: false,
        error: errorMessage,
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
        // Single link: UUID, multi-link: UUID[]
        // For now, we use TEXT[] for multi-link (PostgreSQL doesn't have native UUID[])
        // The actual storage format depends on relationship_type in field options
        return 'TEXT' // Can store single UUID or JSON array of UUIDs
      default:
        return 'TEXT'
    }
  }
}
