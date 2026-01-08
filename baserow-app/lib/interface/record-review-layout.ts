/**
 * Record Review — Two-Column Layout (Airtable-style)
 * 
 * Core Principle:
 * The page is still a single Canvas. The two columns are a layout choice, not a page type.
 * 
 * Canvas Layout Model:
 * - Uses a fixed 12-column grid at the Canvas level
 * - Default column split:
 *   - Left column: 4 cols (list / navigation / context)
 *   - Right column: 8 cols (record details)
 * 
 * Block Placement:
 * Blocks do not know they're in a "left" or "right" column.
 * They only know: Block.layout = { x, y, w, h }
 * The Canvas grid enforces the visual structure.
 * 
 * Record Context Injection:
 * Every block receives: { recordId, tableId, mode: 'view' | 'edit' | 'review' }
 */

import type { BlockDefinition } from './pageTypes.types'

export type RecordReviewMode = 'view' | 'edit' | 'review'

export interface RecordReviewLayoutOptions {
  primaryTableId: string
  mode?: RecordReviewMode
}

/**
 * Creates default two-column layout blocks for a record review page
 * 
 * Left Column (4 cols, x=0):
 * - Record list (filtered to same table)
 * - Status / workflow summary
 * - Key metadata
 * 
 * Right Column (8 cols, x=4):
 * - Record title (large)
 * - Field groups (form-style)
 * - Notes / long text
 * - Related records
 * 
 * @param options Configuration for the layout
 * @returns Array of block definitions with two-column layout
 */
export function createRecordReviewTwoColumnLayout(
  options: RecordReviewLayoutOptions
): BlockDefinition[] {
  const { primaryTableId, mode = 'review' } = options

  return [
    // LEFT COLUMN: Record List (Context / Navigation)
    {
      type: 'grid',
      x: 0, // Left column starts at x=0
      y: 0,
      w: 4, // Left column width: 4 cols
      h: 12,
      config: {
        title: 'Records',
        table_id: primaryTableId,
        view_type: 'grid',
        // Auto-filter to same table (blocks receive pageTableId context)
      },
    },
    // RIGHT COLUMN: Record Details (Main Content)
    {
      type: 'record',
      x: 4, // Right column starts at x=4
      y: 0,
      w: 8, // Right column width: 8 cols
      h: 8,
      config: {
        title: 'Record Details',
        table_id: primaryTableId,
        // record_id will be injected from page context (page.config.record_id)
      },
    },
    // RIGHT COLUMN: Field Groups (Form-style editing)
    {
      type: 'form',
      x: 4, // Right column
      y: 8, // Below record block
      w: 8, // Right column width
      h: 6,
      config: {
        title: 'Edit Fields',
        table_id: primaryTableId,
        allow_editing: mode !== 'view',
        // Fields will be auto-populated from table schema
      },
    },
  ]
}

/**
 * Alternative layout: Left column with compact blocks, Right column with full record
 * Useful for pages where you want more navigation/context in the left column
 */
export function createRecordReviewCompactLayout(
  options: RecordReviewLayoutOptions
): BlockDefinition[] {
  const { primaryTableId, mode = 'review' } = options

  return [
    // LEFT COLUMN: Compact navigation blocks
    {
      type: 'grid',
      x: 0,
      y: 0,
      w: 4,
      h: 10,
      config: {
        title: 'Records',
        table_id: primaryTableId,
        view_type: 'grid',
      },
    },
    // LEFT COLUMN: Status summary (compact)
    {
      type: 'kpi',
      x: 0,
      y: 10,
      w: 4,
      h: 4,
      config: {
        title: 'Status',
        table_id: primaryTableId,
        kpi_field: 'status', // Assumes a status field exists
        kpi_aggregate: 'count',
      },
    },
    // RIGHT COLUMN: Full record view
    {
      type: 'record',
      x: 4,
      y: 0,
      w: 8,
      h: 14,
      config: {
        title: 'Record Details',
        table_id: primaryTableId,
      },
    },
  ]
}

/**
 * Validates that a block layout follows the two-column pattern
 * (Optional helper for development/debugging)
 */
export function validateTwoColumnLayout(blocks: Array<{ x: number; w: number }>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  const leftColumnBlocks = blocks.filter(b => b.x === 0 && b.w <= 4)
  const rightColumnBlocks = blocks.filter(b => b.x >= 4 && b.w <= 8)
  const otherBlocks = blocks.filter(b => !leftColumnBlocks.includes(b) && !rightColumnBlocks.includes(b))

  if (otherBlocks.length > 0) {
    errors.push(`Found ${otherBlocks.length} blocks outside two-column layout`)
  }

  // Check for overlaps
  const sortedByX = [...blocks].sort((a, b) => a.x - b.x)
  for (let i = 0; i < sortedByX.length - 1; i++) {
    const current = sortedByX[i]
    const next = sortedByX[i + 1]
    if (current.x + current.w > next.x) {
      errors.push(`Block overlap detected: block at x=${current.x} overlaps with block at x=${next.x}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
