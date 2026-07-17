/**
 * Extended Utility Functions Tests
 * Comprehensive tests for core utility functions in lib/utils.ts
 * 
 * Run: npm test utils-extended
 */

import { describe, it, expect } from 'vitest'
import {
  cn,
  formatDateUK,
  formatDateObjectUK,
  formatDateTimeUK,
  formatDateTimeObjectUK,
  parseUKDateToISO,
  toISODateString,
} from '@/lib/utils'

describe('Utility Functions - Extended', () => {
  describe('cn() - Class Name Utility', () => {
    it('should merge class names correctly', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
      expect(cn('foo', null, 'bar')).toBe('foo bar')
      expect(cn('foo', undefined, 'bar')).toBe('foo bar')
    })

    it('should handle conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
      expect(cn('foo', true && 'bar', 'baz')).toBe('foo bar baz')
    })

    it('should merge Tailwind classes correctly', () => {
      // twMerge should deduplicate conflicting classes
      expect(cn('px-2', 'px-4')).toContain('px-4')
      expect(cn('text-red-500', 'text-blue-500')).toContain('text-blue-500')
    })
  })

  describe('formatDateUK() - UK Date Formatting', () => {
    it('should format ISO date string to UK format', () => {
      expect(formatDateUK('2024-01-15')).toBe('15/01/2024')
      expect(formatDateUK('2024-12-31')).toBe('31/12/2024')
      expect(formatDateUK('2024-03-05')).toBe('05/03/2024')
    })

    it('should handle ISO timestamp strings', () => {
      expect(formatDateUK('2024-01-15T10:30:00Z')).toBe('15/01/2024')
      expect(formatDateUK('2024-12-31T23:59:59.999Z')).toBe('31/12/2024')
    })

    it('should return placeholder for null/undefined', () => {
      expect(formatDateUK(null)).toBe('—')
      expect(formatDateUK(undefined)).toBe('—')
      expect(formatDateUK(null, 'N/A')).toBe('N/A')
    })

    it('should return placeholder for invalid dates', () => {
      expect(formatDateUK('invalid-date')).toBe('—')
      expect(formatDateUK('2024-13-45')).toBe('—')
      expect(formatDateUK('not-a-date')).toBe('—')
    })

    it('should handle empty strings', () => {
      expect(formatDateUK('')).toBe('—')
      expect(formatDateUK('', 'Empty')).toBe('Empty')
    })
  })

  describe('formatDateObjectUK() - Date Object Formatting', () => {
    it('should format Date object to UK format', () => {
      const date = new Date('2024-01-15')
      expect(formatDateObjectUK(date)).toBe('15/01/2024')
    })

    it('should return placeholder for null/undefined', () => {
      expect(formatDateObjectUK(null)).toBe('—')
      expect(formatDateObjectUK(undefined)).toBe('—')
    })

    it('should return placeholder for invalid Date objects', () => {
      const invalidDate = new Date('invalid')
      expect(formatDateObjectUK(invalidDate)).toBe('—')
    })
  })

  describe('formatDateTimeUK() - UK Date + Time Formatting', () => {
    it('should format ISO timestamp to UK date + time format', () => {
      expect(formatDateTimeUK('2024-01-15T10:30:00Z')).toBe('15/01/2024 10:30')
      expect(formatDateTimeUK('2024-12-31T23:59:00Z')).toBe('31/12/2024 23:59')
    })

    it('should handle date-only strings (defaults to 00:00)', () => {
      expect(formatDateTimeUK('2024-01-15')).toBe('15/01/2024 00:00')
    })

    it('should return placeholder for null/undefined', () => {
      expect(formatDateTimeUK(null)).toBe('—')
      expect(formatDateTimeUK(undefined)).toBe('—')
    })

    it('should return placeholder for invalid timestamps', () => {
      expect(formatDateTimeUK('invalid')).toBe('—')
    })
  })

  describe('formatDateTimeObjectUK() - Date Object + Time Formatting', () => {
    it('should format Date object to UK date + time format', () => {
      const date = new Date('2024-01-15T10:30:00Z')
      const result = formatDateTimeObjectUK(date)
      expect(result).toMatch(/15\/01\/2024 \d{2}:\d{2}/)
    })

    it('should return placeholder for null/undefined', () => {
      expect(formatDateTimeObjectUK(null)).toBe('—')
      expect(formatDateTimeObjectUK(undefined)).toBe('—')
    })
  })

  describe('parseUKDateToISO() - UK Date Parsing', () => {
    it('should parse UK format date to ISO', () => {
      expect(parseUKDateToISO('15/01/2024')).toBe('2024-01-15')
      expect(parseUKDateToISO('31/12/2024')).toBe('2024-12-31')
      expect(parseUKDateToISO('05/03/2024')).toBe('2024-03-05')
    })

    it('should handle single-digit days and months', () => {
      expect(parseUKDateToISO('1/1/2024')).toBe('2024-01-01')
      expect(parseUKDateToISO('5/3/2024')).toBe('2024-03-05')
    })

    it('should return null for invalid formats', () => {
      expect(parseUKDateToISO('invalid')).toBeNull()
      expect(parseUKDateToISO('2024-01-15')).toBeNull() // Wrong format
      expect(parseUKDateToISO('15-01-2024')).toBeNull() // Wrong separator
      expect(parseUKDateToISO('15/13/2024')).toBeNull() // Invalid month
      expect(parseUKDateToISO('32/01/2024')).toBeNull() // Invalid day
      expect(parseUKDateToISO('15/01')).toBeNull() // Missing year
    })

    it('should return null for empty/null/undefined', () => {
      expect(parseUKDateToISO('')).toBeNull()
      expect(parseUKDateToISO('   ')).toBeNull()
      expect(parseUKDateToISO(null as any)).toBeNull()
      expect(parseUKDateToISO(undefined as any)).toBeNull()
    })

    it('should handle edge cases', () => {
      expect(parseUKDateToISO('29/02/2024')).toBe('2024-02-29') // Leap year
      expect(parseUKDateToISO('29/02/2023')).toBeNull() // Not a leap year
    })
  })

  describe('toISODateString() - ISO Date Conversion', () => {
    it('should convert Date object to ISO date string', () => {
      const date = new Date('2024-01-15T10:30:00Z')
      expect(toISODateString(date)).toBe('2024-01-15')
    })

    it('should convert ISO string to ISO date string', () => {
      expect(toISODateString('2024-01-15T10:30:00Z')).toBe('2024-01-15')
      expect(toISODateString('2024-12-31')).toBe('2024-12-31')
    })

    it('should convert UK format string to ISO', () => {
      expect(toISODateString('15/01/2024')).toBe('2024-01-15')
      expect(toISODateString('31/12/2024')).toBe('2024-12-31')
    })

    it('should return null for null/undefined', () => {
      expect(toISODateString(null)).toBeNull()
      expect(toISODateString(undefined)).toBeNull()
    })

    it('should return null for invalid dates', () => {
      expect(toISODateString('invalid')).toBeNull()
      expect(toISODateString('not-a-date')).toBeNull()
    })
  })
})
