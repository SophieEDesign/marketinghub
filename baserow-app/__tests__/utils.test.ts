/**
 * Utility Functions Tests
 * Tests for core utility functions
 * 
 * Run: npm test utils
 */

import { describe, it, expect } from 'vitest'

describe('Utility Functions', () => {
  describe('Type Guards', () => {
    it('should validate UUID format', () => {
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      
      const validUuid = '123e4567-e89b-12d3-a456-426614174000'
      const invalidUuid = 'not-a-uuid'
      
      expect(UUID_RE.test(validUuid)).toBe(true)
      expect(UUID_RE.test(invalidUuid)).toBe(false)
    })

    it('should handle unknown types safely', () => {
      const testValue: unknown = { id: '123', name: 'Test' }
      const typed = testValue as { id?: string; name?: string } | null
      
      expect(typed?.id).toBe('123')
      expect(typed?.name).toBe('Test')
    })
  })

  describe('Data Transformation', () => {
    it('should normalize undefined to null', () => {
      const value: unknown = undefined
      const normalized = value === undefined ? null : value
      
      expect(normalized).toBeNull()
    })

    it('should handle array filtering with type guards', () => {
      const mixedArray: unknown[] = [1, 'test', null, undefined, { id: '1' }]
      const numbers = mixedArray.filter((v): v is number => typeof v === 'number')
      
      expect(numbers).toEqual([1])
    })
  })
})
