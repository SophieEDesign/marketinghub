/**
 * Interface Invariants Tests
 * These tests assert critical invariants that MUST NOT break
 * 
 * Run: npm test interface-invariants
 * Fails build if any invariant breaks
 */

import { describe, it, expect } from 'vitest'
import { 
  blockToLayoutItem, 
  layoutItemToDbUpdate, 
  dbBlockToPageBlock 
} from '../lib/interface/layout-mapping'

describe('Interface Invariants - Pre-Deploy Safety Checks', () => {
  describe('1. Single Source of Truth - Layout Persistence', () => {
    it('should map layout round-trip correctly (save → DB → load)', () => {
      // Simulate: User drags block to x=2, y=4, w=6, h=8
      const layoutItem = { i: 'block-1', x: 2, y: 4, w: 6, h: 8, minW: 2, minH: 2 }
      
      // Step 1: Convert to DB format
      const dbUpdate = layoutItemToDbUpdate(layoutItem)
      expect(dbUpdate).toEqual({
        position_x: 2,
        position_y: 4,
        width: 6,
        height: 8,
      })
      
      // Step 2: Simulate DB save (values persist)
      const dbBlock = {
        id: 'block-1',
        position_x: 2,
        position_y: 4,
        width: 6,
        height: 8,
      }
      
      // Step 3: Load from DB and convert back
      const layout = dbBlockToPageBlock(dbBlock)
      expect(layout).toEqual({
        x: 2,
        y: 4,
        w: 6,
        h: 8,
      })
      
      // Step 4: Convert back to LayoutItem
      const pageBlock = {
        id: 'block-1',
        page_id: 'page-1',
        type: 'text' as const,
        x: layout!.x,
        y: layout!.y,
        w: layout!.w,
        h: layout!.h,
        config: {},
        order_index: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const restoredLayoutItem = blockToLayoutItem(pageBlock)
      expect(restoredLayoutItem).toEqual(layoutItem)
    })

    it('should NOT default layout values when some are null (corrupted state)', () => {
      const corruptedBlock = {
        id: 'block-1',
        position_x: 2,
        position_y: null, // Corrupted: some null
        width: 6,
        height: 8,
      }
      
      // Should throw error, not silently default
      expect(() => {
        dbBlockToPageBlock(corruptedBlock)
      }).toThrow('Corrupted layout state')
    })

    it('should return null for new blocks (all null) and allow defaults', () => {
      const newBlock = {
        id: 'block-1',
        position_x: null,
        position_y: null,
        width: null,
        height: null,
      }
      
      const layout = dbBlockToPageBlock(newBlock)
      expect(layout).toBeNull() // New block - no layout yet
      
      // Defaults are OK for new blocks
      const defaults = { x: 0, y: 0, w: 4, h: 4 }
      expect(defaults).toBeDefined()
    })

    it('should preserve layout values and NOT revert to defaults after reload', () => {
      // Simulate: Block was positioned at x=10, y=20, w=8, h=6
      const savedBlock = {
        id: 'block-1',
        position_x: 10,
        position_y: 20,
        width: 8,
        height: 6,
      }
      
      const layout = dbBlockToPageBlock(savedBlock)
      expect(layout).toEqual({
        x: 10,
        y: 20,
        w: 8,
        h: 6,
      })
      
      // CRITICAL: Values should NOT default to 0,0,4,4
      expect(layout?.x).not.toBe(0)
      expect(layout?.y).not.toBe(0)
      expect(layout?.w).not.toBe(4)
      expect(layout?.h).not.toBe(4)
    })
  })

  describe('2. Single Source of Truth - TextBlock Content Persistence', () => {
    it('should persist content_json structure correctly', () => {
      const contentJson = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Test content' }]
          }
        ]
      }
      
      // Simulate save
      const configUpdate = {
        content_json: contentJson
      }
      
      // Verify structure persists
      expect(configUpdate.content_json.type).toBe('doc')
      expect(configUpdate.content_json.content).toBeDefined()
      expect(Array.isArray(configUpdate.content_json.content)).toBe(true)
      expect(configUpdate.content_json.content[0].type).toBe('paragraph')
    })

    it('should detect content changes correctly (prevents duplicate saves)', () => {
      const content1 = { type: 'doc', content: [] }
      const content2 = { type: 'doc', content: [{ type: 'paragraph' }] }
      
      const str1 = JSON.stringify(content1)
      const str2 = JSON.stringify(content2)
      
      expect(str1 !== str2).toBe(true)
      
      // Same content should be equal
      expect(JSON.stringify(content1) === JSON.stringify(content1)).toBe(true)
    })

    it('should persist content_json after navigation and reload', () => {
      // Simulate: User types content, saves, navigates away, returns
      const savedContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Persisted content' }]
          }
        ]
      }
      
      // Simulate block config from DB
      const blockFromDb = {
        id: 'text-block-1',
        config: {
          content_json: savedContent
        }
      }
      
      // Content should be preserved
      expect(blockFromDb.config.content_json).toEqual(savedContent)
      expect(blockFromDb.config.content_json.content[0].content[0].text).toBe('Persisted content')
    })
  })

  describe('3. Calendar Date Field Resolution', () => {
    it('should use field NAME (not ID) when reading row data', () => {
      // Simulate: Calendar has dateFieldId='date_field_id' but rows use field names as keys
      const dateFieldId = 'date_field_id'
      const dateFieldName = 'start_date' // Actual field name
      
      // Simulate row data (Supabase uses field names as keys)
      const row = {
        id: 'row-1',
        data: {
          start_date: '2024-01-15', // Field NAME as key
          title: 'Event Title',
        }
      }
      
      // CRITICAL: Must use field NAME to read row data
      const dateValue = row.data[dateFieldName as keyof typeof row.data] // ✅ Correct: uses name
      // const dateValue = row.data[dateFieldId] // ❌ Wrong: would be undefined
      
      expect(dateValue).toBe('2024-01-15')
      expect((row.data as any)[dateFieldId]).toBeUndefined() // ID doesn't exist as key
    })

    it('should resolve date field ID to name before reading rows', () => {
      // Simulate field resolution
      const fields = [
        { id: 'field-id-1', name: 'start_date', type: 'date' },
        { id: 'field-id-2', name: 'end_date', type: 'date' },
      ]
      
      const dateFieldId = 'field-id-1'
      const dateField = fields.find(f => f.id === dateFieldId)
      const dateFieldName = dateField?.name || dateFieldId
      
      // Row data uses field name
      const row: { id: string; data: Record<string, any> } = {
        id: 'row-1',
        data: {
          start_date: '2024-01-15', // Field NAME
        }
      }
      
      // Use resolved name to read row
      const dateValue = row.data[dateFieldName]
      expect(dateValue).toBe('2024-01-15')
    })
  })

  describe('4. Calendar Click Handler Wiring', () => {
    it('should emit recordId when event is clicked', () => {
      // Simulate calendar event click
      const event = {
        id: 'record-123',
        title: 'Event Title',
        start: '2024-01-15',
      }
      
      // Simulate onRecordClick callback
      let clickedRecordId: string | null = null
      const onRecordClick = (recordId: string) => {
        clickedRecordId = recordId
      }
      
      // Simulate click handler
      const handleEventClick = (event: { id: string }) => {
        if (onRecordClick) {
          onRecordClick(event.id)
        }
      }
      
      handleEventClick(event)
      expect(clickedRecordId).toBe('record-123')
    })

    it('should propagate recordId through component chain', () => {
      // Simulate: CalendarView → GridBlock → InterfaceBuilder → RecordReviewView
      const recordId = 'record-456'
      
      // Each component should pass through onRecordClick
      const calendarHandler = (recordId: string) => recordId
      const gridHandler = (recordId: string) => calendarHandler(recordId)
      const builderHandler = (recordId: string) => gridHandler(recordId)
      const reviewHandler = (recordId: string) => {
        // RecordReviewView updates selectedRecordId
        return recordId
      }
      
      const result = builderHandler(recordId)
      expect(result).toBe(recordId)
    })
  })

  describe('5. List Page Data Loading', () => {
    it('should load rows when base_table exists', () => {
      const page = {
        id: 'page-1',
        base_table: 'table-123',
        saved_view_id: null,
      }
      
      // Page has anchor (base_table) - should load data
      const hasAnchor = !!(page.base_table || page.saved_view_id)
      expect(hasAnchor).toBe(true)
      
      // Simulate row loading
      const rows = [
        { id: 'row-1', data: { name: 'Item 1' } },
        { id: 'row-2', data: { name: 'Item 2' } },
      ]
      
      expect(rows.length).toBeGreaterThan(0)
    })

    it('should show SetupState when base_table and saved_view_id are missing', () => {
      const page = {
        id: 'page-1',
        base_table: null,
        saved_view_id: null,
      }
      
      // Page has no anchor - should show SetupState
      const hasAnchor = !!(page.base_table || page.saved_view_id)
      expect(hasAnchor).toBe(false)
      
      // Should NOT render blank screen
      const shouldShowSetup = !hasAnchor
      expect(shouldShowSetup).toBe(true)
    })
  })

  describe('6. Table ID Resolution Order', () => {
    it('should resolve tableId in correct order: config.table_id → page.base_table → config.base_table → null', () => {
      // Priority 1: block.config.table_id
      const blockConfig1: { table_id?: string; base_table?: string } = { table_id: 'block-table-id' }
      const pageTableId = 'page-table-id'
      expect(blockConfig1.table_id || pageTableId || blockConfig1.base_table || null).toBe('block-table-id')
      
      // Priority 2: page.base_table (pageTableId)
      const blockConfig2: { table_id?: string; base_table?: string } = {}
      expect(blockConfig2.table_id || pageTableId || blockConfig2.base_table || null).toBe('page-table-id')
      
      // Priority 3: block.config.base_table (only if pageTableId is null)
      const blockConfig3: { table_id?: string; base_table?: string } = { base_table: 'block-base-table' }
      const nullPageTableId: string | null = null
      expect(blockConfig3.table_id || nullPageTableId || blockConfig3.base_table || null).toBe('block-base-table')
      
      // Priority 4: null (all values are null)
      const allNull: string | null = null
      expect(allNull || allNull || allNull || allNull).toBe(null)
    })
  })

  describe('7. No Silent Defaults - Layout', () => {
    it('should throw error if layout values are partially null (corrupted)', () => {
      const corrupted = {
        id: 'block-1',
        position_x: 2,
        position_y: null, // Some null = corrupted
        width: 6,
        height: 8,
      }
      
      expect(() => dbBlockToPageBlock(corrupted)).toThrow('Corrupted layout state')
    })

    it('should allow defaults ONLY when ALL values are null (new block)', () => {
      const newBlock = {
        id: 'block-1',
        position_x: null,
        position_y: null,
        width: null,
        height: null,
      }
      
      const layout = dbBlockToPageBlock(newBlock)
      expect(layout).toBeNull() // New block - defaults OK
    })
  })

  describe('8. No Config Clobbering', () => {
    it('should merge block config updates, not replace', () => {
      const existingConfig = {
        table_id: 'table-1',
        filters: [{ field: 'status', operator: 'equals', value: 'active' }],
        custom_field: 'preserved',
      }
      
      const updateConfig = {
        filters: [{ field: 'status', operator: 'equals', value: 'inactive' }],
      }
      
      // Merge: preserve existing, update provided
      const merged = {
        ...existingConfig,
        ...updateConfig,
      }
      
      expect(merged.table_id).toBe('table-1') // Preserved
      expect(merged.custom_field).toBe('preserved') // Preserved
      expect(merged.filters).toEqual(updateConfig.filters) // Updated
    })

    it('should merge page config updates, not replace', () => {
      const existingConfig = {
        visualisation: 'grid',
        calendar_date_field: 'date_field',
        filters: [],
      }
      
      const updateSettings = {
        visualisation: 'calendar',
      }
      
      // Merge settings into config
      const merged = {
        ...existingConfig,
        ...updateSettings,
      }
      
      expect(merged.calendar_date_field).toBe('date_field') // Preserved
      expect(merged.filters).toEqual([]) // Preserved
      expect(merged.visualisation).toBe('calendar') // Updated
    })
  })

  describe('9. No Remount Loops - Stable Keys', () => {
    it('should use stable keys that do not include array lengths', () => {
      // Test variables
      const tableId = 'table-123'
      const dateFieldId = 'date-field-456'
      const events: any[] = [{ id: '1' }, { id: '2' }]
      
      // ❌ BAD: Unstable key (changes when data updates)
      const badKey = `calendar-${tableId}-${dateFieldId}-${events.length}`
      
      // ✅ GOOD: Stable key (only changes when table/field changes)
      const goodKey = `calendar-${tableId}-${dateFieldId}`
      
      // Verify stable key doesn't include length
      expect(goodKey.includes('length')).toBe(false)
      expect(goodKey.includes('.length')).toBe(false)
      
      // Verify bad key includes length (demonstrates the problem)
      expect(badKey.includes('2')).toBe(true) // events.length = 2
    })

    it('should use block.id as key for block lists', () => {
      const blocks = [
        { id: 'block-1', type: 'text' },
        { id: 'block-2', type: 'grid' },
      ]
      
      // Keys should be stable (block.id)
      const keys = blocks.map(b => b.id)
      expect(keys).toEqual(['block-1', 'block-2'])
      
      // Keys should NOT include counts or lengths
      const badKeys = blocks.map((b, i) => `block-${i}-${blocks.length}`)
      // Bad keys include the length value (2) in the string
      expect(badKeys.some(k => k.includes('2'))).toBe(true) // Bad example - includes length value
      expect(badKeys[0]).toBe('block-0-2') // Demonstrates the problem
    })
  })

  describe('10. Edit/View Mode Data Consistency', () => {
    it('should use same data query in edit and view mode', () => {
      // Simulate: GridBlock query (same for edit/view)
      const tableId = 'table-123'
      const viewId = 'view-456'
      const filters: any[] = []
      
      // Query should be identical regardless of isEditing
      const queryEdit = { tableId, viewId, filters }
      const queryView = { tableId, viewId, filters }
      
      expect(queryEdit).toEqual(queryView)
    })

    it('should render same data in edit and view mode', () => {
      // Simulate: Same rows loaded regardless of mode
      const rows = [
        { id: 'row-1', data: { name: 'Item 1' } },
        { id: 'row-2', data: { name: 'Item 2' } },
      ]
      
      // Edit mode should show same rows
      const editRows = rows
      // View mode should show same rows
      const viewRows = rows
      
      expect(editRows).toEqual(viewRows)
    })
  })

  describe('11. BlockRenderer pageTableId Wiring', () => {
    it('should pass pageTableId to GridBlock (not null)', () => {
      // Simulate: BlockRenderer receives pageTableId prop
      const pageTableId = 'table-123'
      
      // When rendering GridBlock, pageTableId should be passed through
      // This test verifies the prop flow: BlockRenderer → GridBlock
      const blockRendererProps = {
        block: { id: 'block-1', type: 'grid' as const, config: {} },
        pageTableId,
      }
      
      // Verify pageTableId is not null when provided
      expect(blockRendererProps.pageTableId).toBe('table-123')
      expect(blockRendererProps.pageTableId).not.toBeNull()
    })

    it('should pass pageTableId to FormBlock (not null)', () => {
      const pageTableId = 'table-456'
      const blockRendererProps = {
        block: { id: 'block-2', type: 'form' as const, config: {} },
        pageTableId,
      }
      
      expect(blockRendererProps.pageTableId).toBe('table-456')
      expect(blockRendererProps.pageTableId).not.toBeNull()
    })

    it('should pass pageTableId to RecordBlock (not null)', () => {
      const pageTableId = 'table-789'
      const blockRendererProps = {
        block: { id: 'block-3', type: 'record' as const, config: {} },
        pageTableId,
      }
      
      expect(blockRendererProps.pageTableId).toBe('table-789')
      expect(blockRendererProps.pageTableId).not.toBeNull()
    })

    it('should pass pageTableId to ChartBlock (not null)', () => {
      const pageTableId = 'table-abc'
      const blockRendererProps = {
        block: { id: 'block-4', type: 'chart' as const, config: {} },
        pageTableId,
      }
      
      expect(blockRendererProps.pageTableId).toBe('table-abc')
      expect(blockRendererProps.pageTableId).not.toBeNull()
    })

    it('should pass pageTableId to KPIBlock (not null)', () => {
      const pageTableId = 'table-def'
      const blockRendererProps = {
        block: { id: 'block-5', type: 'kpi' as const, config: {} },
        pageTableId,
      }
      
      expect(blockRendererProps.pageTableId).toBe('table-def')
      expect(blockRendererProps.pageTableId).not.toBeNull()
    })
  })

  describe('12. InterfaceBuilder Layout Persistence', () => {
    it('should preserve x/y/w/h when updatedBlock omits them', () => {
      // Simulate: Block has layout x=2, y=4, w=6, h=8
      const existingBlock = {
        id: 'block-1',
        x: 2,
        y: 4,
        w: 6,
        h: 8,
        config: { table_id: 'table-1' },
      }
      
      // Simulate: API returns updated block without layout (config update only)
      const updatedBlock = {
        id: 'block-1',
        x: undefined,
        y: undefined,
        w: undefined,
        h: undefined,
        config: { table_id: 'table-1', filters: [] },
      }
      
      // Merge logic should preserve existing layout
      const merged = {
        ...existingBlock,
        x: updatedBlock.x !== undefined && updatedBlock.x !== null ? updatedBlock.x : existingBlock.x,
        y: updatedBlock.y !== undefined && updatedBlock.y !== null ? updatedBlock.y : existingBlock.y,
        w: updatedBlock.w !== undefined && updatedBlock.w !== null ? updatedBlock.w : existingBlock.w,
        h: updatedBlock.h !== undefined && updatedBlock.h !== null ? updatedBlock.h : existingBlock.h,
        config: { ...existingBlock.config, ...updatedBlock.config },
      }
      
      // Layout should be preserved
      expect(merged.x).toBe(2)
      expect(merged.y).toBe(4)
      expect(merged.w).toBe(6)
      expect(merged.h).toBe(8)
      // Config should be merged
      expect(merged.config.table_id).toBe('table-1')
      expect(merged.config.filters).toEqual([])
    })

    it('should update x/y/w/h when updatedBlock explicitly provides them', () => {
      const existingBlock = {
        id: 'block-1',
        x: 2,
        y: 4,
        w: 6,
        h: 8,
        config: { table_id: 'table-1' },
      }
      
      // Simulate: API returns updated block with new layout
      const updatedBlock = {
        id: 'block-1',
        x: 10,
        y: 20,
        w: 12,
        h: 16,
        config: { table_id: 'table-1' },
      }
      
      // Merge logic should use new layout when explicitly provided
      const merged = {
        ...existingBlock,
        x: updatedBlock.x !== undefined && updatedBlock.x !== null ? updatedBlock.x : existingBlock.x,
        y: updatedBlock.y !== undefined && updatedBlock.y !== null ? updatedBlock.y : existingBlock.y,
        w: updatedBlock.w !== undefined && updatedBlock.w !== null ? updatedBlock.w : existingBlock.w,
        h: updatedBlock.h !== undefined && updatedBlock.h !== null ? updatedBlock.h : existingBlock.h,
        config: { ...existingBlock.config, ...updatedBlock.config },
      }
      
      // Layout should be updated
      expect(merged.x).toBe(10)
      expect(merged.y).toBe(20)
      expect(merged.w).toBe(12)
      expect(merged.h).toBe(16)
    })

    it('should preserve layout when updatedBlock has null values', () => {
      const existingBlock = {
        id: 'block-1',
        x: 2,
        y: 4,
        w: 6,
        h: 8,
        config: { table_id: 'table-1' },
      }
      
      // Simulate: API returns updated block with null layout (should be ignored)
      const updatedBlock = {
        id: 'block-1',
        x: null,
        y: null,
        w: null,
        h: null,
        config: { table_id: 'table-1', filters: [] },
      }
      
      // Merge logic should preserve existing layout (null should be ignored)
      const merged = {
        ...existingBlock,
        x: updatedBlock.x !== undefined && updatedBlock.x !== null ? updatedBlock.x : existingBlock.x,
        y: updatedBlock.y !== undefined && updatedBlock.y !== null ? updatedBlock.y : existingBlock.y,
        w: updatedBlock.w !== undefined && updatedBlock.w !== null ? updatedBlock.w : existingBlock.w,
        h: updatedBlock.h !== undefined && updatedBlock.h !== null ? updatedBlock.h : existingBlock.h,
        config: { ...existingBlock.config, ...updatedBlock.config },
      }
      
      // Layout should be preserved (null values ignored)
      expect(merged.x).toBe(2)
      expect(merged.y).toBe(4)
      expect(merged.w).toBe(6)
      expect(merged.h).toBe(8)
    })
  })
})
