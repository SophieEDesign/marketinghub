/**
 * Data View Clipboard Tests
 * Tests for lib/dataView/clipboard.ts
 * 
 * Run: npm test data-view-clipboard
 */

import { describe, it, expect } from 'vitest'
import {
  parseClipboardText,
  formatClipboardText,
  formatCellValue,
  parseCellValue,
} from '@/lib/dataView/clipboard'
import type { TableField } from '@/types/fields'

describe('Data View Clipboard Operations', () => {
  describe('parseClipboardText()', () => {
    it('should parse simple tab-separated text', () => {
      const text = 'A\tB\tC'
      const result = parseClipboardText(text)
      expect(result).toEqual([['A', 'B', 'C']])
    })

    it('should parse multiple rows', () => {
      const text = 'A\tB\nC\tD'
      const result = parseClipboardText(text)
      expect(result).toEqual([['A', 'B'], ['C', 'D']])
    })

    it('should handle empty cells', () => {
      const text = 'A\t\tC'
      const result = parseClipboardText(text)
      expect(result).toEqual([['A', '', 'C']])
    })

    it('should handle empty rows', () => {
      const text = 'A\tB\n\nC\tD'
      const result = parseClipboardText(text)
      expect(result).toEqual([['A', 'B'], [''], ['C', 'D']])
    })

    it('should trim trailing newlines', () => {
      const text = 'A\tB\nC\tD\n\n'
      const result = parseClipboardText(text)
      expect(result).toEqual([['A', 'B'], ['C', 'D']])
    })

    it('should handle Windows line endings (\\r\\n)', () => {
      const text = 'A\tB\r\nC\tD'
      const result = parseClipboardText(text)
      expect(result).toEqual([['A', 'B'], ['C', 'D']])
    })

    it('should return empty array for empty string', () => {
      expect(parseClipboardText('')).toEqual([])
      expect(parseClipboardText('   ')).toEqual([])
    })

    it('should handle null/undefined', () => {
      expect(parseClipboardText(null as any)).toEqual([])
      expect(parseClipboardText(undefined as any)).toEqual([])
    })

    it('should preserve whitespace within cells', () => {
      const text = '  A  \t  B  '
      const result = parseClipboardText(text)
      // Note: parseClipboardText trims the entire text first, so leading/trailing whitespace is removed
      // but whitespace between tabs is preserved
      expect(result).toEqual([['A  ', '  B']])
    })
  })

  describe('formatClipboardText()', () => {
    it('should format simple grid', () => {
      const grid = [['A', 'B', 'C']]
      const result = formatClipboardText(grid)
      expect(result).toBe('A\tB\tC')
    })

    it('should format multiple rows', () => {
      const grid = [['A', 'B'], ['C', 'D']]
      const result = formatClipboardText(grid)
      expect(result).toBe('A\tB\nC\tD')
    })

    it('should handle empty cells', () => {
      const grid = [['A', '', 'C']]
      const result = formatClipboardText(grid)
      expect(result).toBe('A\t\tC')
    })

    it('should return empty string for empty grid', () => {
      expect(formatClipboardText([])).toBe('')
    })
  })

  describe('formatCellValue()', () => {
    it('should return empty string for null/undefined', () => {
      expect(formatCellValue(null)).toBe('')
      expect(formatCellValue(undefined)).toBe('')
    })

    it('should convert numbers to string', () => {
      expect(formatCellValue(123)).toBe('123')
      expect(formatCellValue(45.67)).toBe('45.67')
    })

    it('should format arrays with comma separation', () => {
      expect(formatCellValue(['A', 'B', 'C'])).toBe('A, B, C')
    })

    it('should stringify objects', () => {
      const obj = { key: 'value', number: 123 }
      const result = formatCellValue(obj)
      expect(result).toBe(JSON.stringify(obj))
    })

    it('should handle linked fields with array values', () => {
      const field: TableField = {
        id: '1',
        name: 'link_field',
        type: 'link_to_table',
        options: { linked_table_id: '123' },
      }
      const result = formatCellValue(['id1', 'id2'], field)
      expect(result).toBe('id1, id2')
    })

    it('should handle single select fields', () => {
      const field: TableField = {
        id: '1',
        name: 'select_field',
        type: 'single_select',
      }
      expect(formatCellValue('Option 1', field)).toBe('Option 1')
    })

    it('should handle multi-select fields', () => {
      const field: TableField = {
        id: '1',
        name: 'multi_select_field',
        type: 'multi_select',
      }
      expect(formatCellValue(['Option 1', 'Option 2'], field)).toBe('Option 1, Option 2')
    })
  })

  describe('parseCellValue()', () => {
    it('should return null for empty strings', () => {
      expect(parseCellValue('')).toBeNull()
      expect(parseCellValue('   ')).toBeNull()
    })

    it('should parse number fields', () => {
      expect(parseCellValue('123', 'number')).toBe(123)
      expect(parseCellValue('45.67', 'number')).toBe(45.67)
      expect(parseCellValue('not-a-number', 'number')).toBeNull()
    })

    it('should parse checkbox fields', () => {
      expect(parseCellValue('true', 'checkbox')).toBe(true)
      expect(parseCellValue('1', 'checkbox')).toBe(true)
      expect(parseCellValue('yes', 'checkbox')).toBe(true)
      expect(parseCellValue('false', 'checkbox')).toBe(false)
      expect(parseCellValue('0', 'checkbox')).toBe(false)
    })

    it('should parse date fields', () => {
      const result = parseCellValue('2024-01-15', 'date')
      expect(result).toMatch(/2024-01-15/)
    })

    it('should parse JSON fields', () => {
      const result = parseCellValue('{"key":"value"}', 'json')
      expect(result).toEqual({ key: 'value' })
    })

    it('should return raw text for invalid JSON', () => {
      const result = parseCellValue('not json', 'json')
      expect(result).toBe('not json')
    })

    it('should return null for lookup fields', () => {
      expect(parseCellValue('any value', 'lookup')).toBeNull()
    })

    it('should return raw text for link_to_table fields', () => {
      expect(parseCellValue('display name', 'link_to_table')).toBe('display name')
    })

    it('should parse single select with field options', () => {
      const field: TableField = {
        id: '1',
        name: 'select_field',
        type: 'single_select',
        options: { choices: ['Option 1', 'Option 2'] },
      }
      expect(parseCellValue('Option 1', 'single_select', field)).toBe('Option 1')
    })

    it('should parse multi-select with comma separation', () => {
      const field: TableField = {
        id: '1',
        name: 'multi_select_field',
        type: 'multi_select',
        options: { choices: ['Option 1', 'Option 2', 'Option 3'] },
      }
      const result = parseCellValue('Option 1, Option 2', 'multi_select', field)
      expect(result).toEqual(['Option 1', 'Option 2'])
    })

    it('should trim values in multi-select', () => {
      const field: TableField = {
        id: '1',
        name: 'multi_select_field',
        type: 'multi_select',
        options: { choices: ['Option 1', 'Option 2'] },
      }
      const result = parseCellValue(' Option 1 , Option 2 ', 'multi_select', field)
      expect(result).toEqual(['Option 1', 'Option 2'])
    })

    it('should return trimmed string for text fields', () => {
      expect(parseCellValue('  Hello World  ', 'text')).toBe('Hello World')
    })
  })
})
