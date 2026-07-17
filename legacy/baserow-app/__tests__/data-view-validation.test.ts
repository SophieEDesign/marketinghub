/**
 * Data View Validation Tests
 * Tests for lib/dataView/validation.ts
 * 
 * Run: npm test data-view-validation
 */

import { describe, it, expect } from 'vitest'
import { validateValue, type ValidationResult } from '@/lib/dataView/validation'
import type { TableField } from '@/types/fields'

describe('Data View Validation', () => {
  describe('Required Field Validation', () => {
    it('should reject null for required fields', () => {
      const field: TableField = {
        id: '1',
        name: 'required_field',
        type: 'text',
        required: true,
      }
      const result = validateValue(field, null)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should reject empty string for required fields', () => {
      const field: TableField = {
        id: '1',
        name: 'required_field',
        type: 'text',
        required: true,
      }
      const result = validateValue(field, '')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should accept null for optional fields', () => {
      const field: TableField = {
        id: '1',
        name: 'optional_field',
        type: 'text',
        required: false,
      }
      const result = validateValue(field, null)
      expect(result.valid).toBe(true)
      expect(result.normalizedValue).toBeNull()
    })
  })

  describe('Text Field Validation', () => {
    it('should accept valid text values', () => {
      const field: TableField = {
        id: '1',
        name: 'text_field',
        type: 'text',
      }
      const result = validateValue(field, 'Hello World')
      expect(result.valid).toBe(true)
      expect(result.normalizedValue).toBe('Hello World')
    })

    it('should convert non-string values to string', () => {
      const field: TableField = {
        id: '1',
        name: 'text_field',
        type: 'text',
      }
      const result = validateValue(field, 123)
      expect(result.valid).toBe(true)
      expect(result.normalizedValue).toBe('123')
    })
  })

  describe('Email Field Validation', () => {
    it('should accept valid email addresses', () => {
      const field: TableField = {
        id: '1',
        name: 'email_field',
        type: 'email',
      }
      const result = validateValue(field, 'test@example.com')
      expect(result.valid).toBe(true)
      expect(result.normalizedValue).toBe('test@example.com')
    })

    it('should reject invalid email addresses', () => {
      const field: TableField = {
        id: '1',
        name: 'email_field',
        type: 'email',
      }
      const result1 = validateValue(field, 'not-an-email')
      expect(result1.valid).toBe(false)
      expect(result1.error).toContain('email')

      const result2 = validateValue(field, 'test@')
      expect(result2.valid).toBe(false)

      const result3 = validateValue(field, '@example.com')
      expect(result3.valid).toBe(false)
    })
  })

  describe('URL Field Validation', () => {
    it('should accept valid URLs', () => {
      const field: TableField = {
        id: '1',
        name: 'url_field',
        type: 'url',
      }
      const result1 = validateValue(field, 'https://example.com')
      expect(result1.valid).toBe(true)

      const result2 = validateValue(field, 'http://example.com/path')
      expect(result2.valid).toBe(true)
    })

    it('should reject invalid URLs', () => {
      const field: TableField = {
        id: '1',
        name: 'url_field',
        type: 'url',
      }
      const result = validateValue(field, 'not-a-url')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('URL')
    })
  })

  describe('Number Field Validation', () => {
    it('should accept valid numbers', () => {
      const field: TableField = {
        id: '1',
        name: 'number_field',
        type: 'number',
      }
      const result1 = validateValue(field, 123)
      expect(result1.valid).toBe(true)
      expect(result1.normalizedValue).toBe(123)

      const result2 = validateValue(field, '456')
      expect(result2.valid).toBe(true)
      expect(result2.normalizedValue).toBe(456)
    })

    it('should reject invalid numbers', () => {
      const field: TableField = {
        id: '1',
        name: 'number_field',
        type: 'number',
      }
      const result = validateValue(field, 'not-a-number')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('number')
    })

    it('should apply precision if specified', () => {
      const field: TableField = {
        id: '1',
        name: 'number_field',
        type: 'number',
        options: { precision: 2 },
      }
      const result = validateValue(field, 123.456789)
      expect(result.valid).toBe(true)
      expect(result.normalizedValue).toBe(123.46)
    })
  })

  describe('Date Field Validation', () => {
    it('should accept valid date strings', () => {
      const field: TableField = {
        id: '1',
        name: 'date_field',
        type: 'date',
      }
      const result1 = validateValue(field, '2024-01-15')
      expect(result1.valid).toBe(true)
      expect(result1.normalizedValue).toMatch(/2024-01-15/)

      const result2 = validateValue(field, new Date('2024-01-15'))
      expect(result2.valid).toBe(true)
    })

    it('should reject invalid date strings', () => {
      const field: TableField = {
        id: '1',
        name: 'date_field',
        type: 'date',
      }
      const result = validateValue(field, 'not-a-date')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('date')
    })
  })

  describe('Single Select Field Validation', () => {
    it('should accept valid choice', () => {
      const field: TableField = {
        id: '1',
        name: 'select_field',
        type: 'single_select',
        options: { choices: ['Option 1', 'Option 2', 'Option 3'] },
      }
      const result = validateValue(field, 'Option 1')
      expect(result.valid).toBe(true)
      expect(result.normalizedValue).toBe('Option 1')
    })

    it('should reject invalid choice', () => {
      const field: TableField = {
        id: '1',
        name: 'select_field',
        type: 'single_select',
        options: { choices: ['Option 1', 'Option 2'] },
      }
      const result = validateValue(field, 'Invalid Option')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('valid choice')
    })

    it('should accept any value if no choices defined', () => {
      const field: TableField = {
        id: '1',
        name: 'select_field',
        type: 'single_select',
      }
      const result = validateValue(field, 'Any Value')
      expect(result.valid).toBe(true)
    })
  })

  describe('Multi Select Field Validation', () => {
    it('should accept valid choices array', () => {
      const field: TableField = {
        id: '1',
        name: 'multi_select_field',
        type: 'multi_select',
        options: { choices: ['Option 1', 'Option 2', 'Option 3'] },
      }
      const result = validateValue(field, ['Option 1', 'Option 2'])
      expect(result.valid).toBe(true)
      expect(result.normalizedValue).toEqual(['Option 1', 'Option 2'])
    })

    it('should reject invalid choices', () => {
      const field: TableField = {
        id: '1',
        name: 'multi_select_field',
        type: 'multi_select',
        options: { choices: ['Option 1', 'Option 2'] },
      }
      const result = validateValue(field, ['Option 1', 'Invalid'])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid choices')
    })

    it('should remove duplicates from multi-select', () => {
      const field: TableField = {
        id: '1',
        name: 'multi_select_field',
        type: 'multi_select',
        options: { choices: ['Option 1', 'Option 2'] },
      }
      const result = validateValue(field, ['Option 1', 'Option 1', 'Option 2'])
      expect(result.valid).toBe(true)
      expect(result.normalizedValue).toEqual(['Option 1', 'Option 2'])
    })

    it('should convert single value to array', () => {
      const field: TableField = {
        id: '1',
        name: 'multi_select_field',
        type: 'multi_select',
        options: { choices: ['Option 1', 'Option 2'] },
      }
      const result = validateValue(field, 'Option 1')
      expect(result.valid).toBe(true)
      expect(result.normalizedValue).toEqual(['Option 1'])
    })
  })

  describe('Checkbox Field Validation', () => {
    it('should accept boolean true', () => {
      const field: TableField = {
        id: '1',
        name: 'checkbox_field',
        type: 'checkbox',
      }
      const result = validateValue(field, true)
      expect(result.valid).toBe(true)
      expect(result.normalizedValue).toBe(true)
    })

    it('should accept truthy string values', () => {
      const field: TableField = {
        id: '1',
        name: 'checkbox_field',
        type: 'checkbox',
      }
      expect(validateValue(field, 'true').normalizedValue).toBe(true)
      expect(validateValue(field, '1').normalizedValue).toBe(true)
      expect(validateValue(field, 'yes').normalizedValue).toBe(true)
    })

    it('should convert falsy values to false', () => {
      const field: TableField = {
        id: '1',
        name: 'checkbox_field',
        type: 'checkbox',
      }
      expect(validateValue(field, false).normalizedValue).toBe(false)
      expect(validateValue(field, 'false').normalizedValue).toBe(false)
      expect(validateValue(field, 0).normalizedValue).toBe(false)
    })
  })

  describe('Link to Table Field Validation', () => {
    it('should accept valid UUID string', () => {
      const field: TableField = {
        id: '1',
        name: 'link_field',
        type: 'link_to_table',
        options: { linked_table_id: '123e4567-e89b-12d3-a456-426614174000' },
      }
      const validUuid = '123e4567-e89b-12d3-a456-426614174000'
      const result = validateValue(field, validUuid)
      expect(result.valid).toBe(true)
      expect(result.normalizedValue).toBe(validUuid)
    })

    it('should accept array of UUIDs for multi-link', () => {
      const field: TableField = {
        id: '1',
        name: 'link_field',
        type: 'link_to_table',
        options: { linked_table_id: '123e4567-e89b-12d3-a456-426614174000' },
      }
      const uuids = [
        '123e4567-e89b-12d3-a456-426614174000',
        '223e4567-e89b-12d3-a456-426614174001',
      ]
      const result = validateValue(field, uuids)
      expect(result.valid).toBe(true)
      expect(result.normalizedValue).toEqual(uuids)
    })

    it('should reject invalid UUID format', () => {
      const field: TableField = {
        id: '1',
        name: 'link_field',
        type: 'link_to_table',
        options: { linked_table_id: '123e4567-e89b-12d3-a456-426614174000' },
      }
      const result = validateValue(field, 'not-a-uuid')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('record ID')
    })
  })

  describe('JSON Field Validation', () => {
    it('should accept valid JSON objects', () => {
      const field: TableField = {
        id: '1',
        name: 'json_field',
        type: 'json',
      }
      const obj = { key: 'value', number: 123 }
      const result = validateValue(field, obj)
      expect(result.valid).toBe(true)
      expect(result.normalizedValue).toEqual(obj)
    })

    it('should parse JSON strings', () => {
      const field: TableField = {
        id: '1',
        name: 'json_field',
        type: 'json',
      }
      const result = validateValue(field, '{"key":"value"}')
      expect(result.valid).toBe(true)
      expect(result.normalizedValue).toEqual({ key: 'value' })
    })

    it('should reject invalid JSON strings', () => {
      const field: TableField = {
        id: '1',
        name: 'json_field',
        type: 'json',
      }
      const result = validateValue(field, 'not valid json')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('JSON')
    })
  })

  describe('Formula and Lookup Fields', () => {
    it('should reject edits to formula fields', () => {
      const field: TableField = {
        id: '1',
        name: 'formula_field',
        type: 'formula',
      }
      const result = validateValue(field, 'any value')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('computed field')
    })

    it('should reject edits to lookup fields', () => {
      const field: TableField = {
        id: '1',
        name: 'lookup_field',
        type: 'lookup',
      }
      const result = validateValue(field, 'any value')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('computed field')
    })
  })
})
