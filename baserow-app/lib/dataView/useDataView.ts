/**
 * React hook for DataViewService
 * Provides copy/paste/duplicate operations with undo/redo support
 */

import { useCallback, useRef, useState, useMemo } from 'react'
import { DataViewService } from './DataViewService'
import type { DataViewContext, Selection, CellChange, BatchMutationResult, DuplicateColumnOptions } from './types'

export interface UseDataViewOptions {
  context: DataViewContext
  onChangesApplied?: (result: BatchMutationResult) => void
  onError?: (error: Error) => void
}

export interface UseDataViewReturn {
  // Copy/paste
  copy: (selection: Selection) => string
  paste: (selection: Selection, clipboardText: string) => Promise<BatchMutationResult>
  
  // Column operations
  duplicateColumn: (columnId: string, options?: DuplicateColumnOptions) => Promise<{ success: boolean; newColumnId?: string; error?: string }>
  
  // Validation
  validateValue: (columnId: string, value: any) => { valid: boolean; error?: string; normalizedValue?: any }
  
  // Undo/redo
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  
  // Update context
  updateContext: (context: Partial<DataViewContext>) => void
}

/**
 * History entry for undo/redo
 */
interface HistoryEntry {
  changes: CellChange[]
  timestamp: number
}

const MAX_HISTORY = 50

export function useDataView(options: UseDataViewOptions): UseDataViewReturn {
  const { context, onChangesApplied, onError } = options

  // Create service instance
  const serviceRef = useRef<DataViewService | null>(null)
  if (!serviceRef.current) {
    serviceRef.current = new DataViewService(context)
  }

  // Update service context when context changes
  const currentContextRef = useRef(context)
  if (currentContextRef.current !== context) {
    serviceRef.current.updateContext(context)
    currentContextRef.current = context
  }

  // Undo/redo history
  const [history, setHistory] = useState<{
    past: HistoryEntry[]
    present: HistoryEntry | null
    future: HistoryEntry[]
  }>({
    past: [],
    present: null,
    future: [],
  })

  // Copy operation
  const copy = useCallback(
    (selection: Selection): string => {
      if (!serviceRef.current) return ''
      return serviceRef.current.copy(selection)
    },
    []
  )

  // Paste operation with undo/redo support
  const paste = useCallback(
    async (selection: Selection, clipboardText: string): Promise<BatchMutationResult> => {
      if (!serviceRef.current) {
        throw new Error('DataViewService not initialized')
      }

      try {
        // Parse clipboard text
        const { parseClipboardText } = require('./clipboard')
        const clipboardGrid = parseClipboardText(clipboardText)

        if (clipboardGrid.length === 0) {
          return {
            success: false,
            changes: [],
            errors: [],
            appliedCount: 0,
            errorCount: 0,
          }
        }

        // Resolve paste intent
        const intent = serviceRef.current.resolvePasteIntent(selection, clipboardText)
        if (!intent) {
          return {
            success: false,
            changes: [],
            errors: [],
            appliedCount: 0,
            errorCount: 0,
          }
        }

        // Build cell changes from paste intent and clipboard grid
        const changes: CellChange[] = []
        
        if (intent.pasteMode === 'vertical') {
          // Paste one value per row (from first column of clipboard)
          intent.targetCells.forEach((target, index) => {
            const value = clipboardGrid[index]?.[0] || ''
            if (value.trim() !== '') {
              changes.push({
                rowId: target.rowId,
                columnId: target.columnId,
                fieldName: target.fieldName,
                value,
              })
            }
          })
        } else if (intent.pasteMode === 'horizontal') {
          // Paste one value per column (from first row of clipboard)
          intent.targetCells.forEach((target, index) => {
            const value = clipboardGrid[0]?.[index] || ''
            if (value.trim() !== '') {
              changes.push({
                rowId: target.rowId,
                columnId: target.columnId,
                fieldName: target.fieldName,
                value,
              })
            }
          })
        } else {
          // Paste as 2D grid
          // Group target cells by row to map to clipboard grid
          const cellsByRow = new Map<string, typeof intent.targetCells>()
          intent.targetCells.forEach(target => {
            if (!cellsByRow.has(target.rowId)) {
              cellsByRow.set(target.rowId, [])
            }
            cellsByRow.get(target.rowId)!.push(target)
          })

          const sortedRows = Array.from(cellsByRow.keys())
          sortedRows.forEach((rowId, rowIndex) => {
            const rowCells = cellsByRow.get(rowId)!
            // Sort by column order
            rowCells.sort((a, b) => {
              const aIndex = intent.targetCells.findIndex(t => t.columnId === a.columnId && t.rowId === a.rowId)
              const bIndex = intent.targetCells.findIndex(t => t.columnId === b.columnId && t.rowId === b.rowId)
              return aIndex - bIndex
            })

            rowCells.forEach((target, colIndex) => {
              const value = clipboardGrid[rowIndex]?.[colIndex] || ''
              if (value.trim() !== '') {
                changes.push({
                  rowId: target.rowId,
                  columnId: target.columnId,
                  fieldName: target.fieldName,
                  value,
                })
              }
            })
          })
        }

        // Apply changes
        const result = await serviceRef.current.applyCellChanges(changes)

        // Add to history for undo
        if (result.appliedCount > 0) {
          setHistory(prev => {
            const newPast = prev.present
              ? [...prev.past.slice(-MAX_HISTORY + 1), prev.present]
              : prev.past.slice(-MAX_HISTORY + 1)

            return {
              past: newPast,
              present: {
                changes: result.changes,
                timestamp: Date.now(),
              },
              future: [], // Clear future on new action
            }
          })
        }

        // Notify callback
        if (onChangesApplied) {
          onChangesApplied(result)
        }

        return result
      } catch (error: any) {
        if (onError) {
          onError(error)
        }
        throw error
      }
    },
    [onChangesApplied, onError]
  )

  // Duplicate column
  const duplicateColumn = useCallback(
    async (columnId: string, options?: DuplicateColumnOptions) => {
      if (!serviceRef.current) {
        return { success: false, error: 'DataViewService not initialized' }
      }

      try {
        return await serviceRef.current.duplicateColumn(columnId, options)
      } catch (error: any) {
        if (onError) {
          onError(error)
        }
        return { success: false, error: error.message || 'Failed to duplicate column' }
      }
    },
    [onError]
  )

  // Validate value
  const validateValue = useCallback(
    (columnId: string, value: any) => {
      if (!serviceRef.current) {
        return { valid: false, error: 'DataViewService not initialized' }
      }
      return serviceRef.current.validateValue(columnId, value)
    },
    []
  )

  // Undo
  const undo = useCallback(async () => {
    if (history.past.length === 0 || !history.present) {
      return
    }

    const previousEntry = history.past[history.past.length - 1]
    if (!previousEntry || !serviceRef.current) {
      return
    }

    // Reverse the changes
    const reversedChanges: CellChange[] = history.present.changes.map(change => ({
      ...change,
      value: change.previousValue,
      previousValue: change.value,
    }))

    // Apply reversed changes
    const result = await serviceRef.current.applyCellChanges(reversedChanges)

    // Update history
    setHistory(prev => ({
      past: prev.past.slice(0, -1),
      present: previousEntry,
      future: prev.present ? [prev.present, ...prev.future] : prev.future,
    }))

    if (onChangesApplied) {
      onChangesApplied(result)
    }
  }, [history, onChangesApplied])

  // Redo
  const redo = useCallback(async () => {
    if (history.future.length === 0 || !serviceRef.current) {
      return
    }

    const nextEntry = history.future[0]
    if (!nextEntry) {
      return
    }

    // Re-apply the changes
    const result = await serviceRef.current.applyCellChanges(nextEntry.changes)

    // Update history
    setHistory(prev => ({
      past: prev.present ? [...prev.past, prev.present] : prev.past,
      present: nextEntry,
      future: prev.future.slice(1),
    }))

    if (onChangesApplied) {
      onChangesApplied(result)
    }
  }, [history, onChangesApplied])

  // Update context
  const updateContext = useCallback((newContext: Partial<DataViewContext>) => {
    if (serviceRef.current) {
      serviceRef.current.updateContext(newContext)
      currentContextRef.current = { ...currentContextRef.current, ...newContext }
    }
  }, [])

  return {
    copy,
    paste,
    duplicateColumn,
    validateValue,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    updateContext,
  }
}
