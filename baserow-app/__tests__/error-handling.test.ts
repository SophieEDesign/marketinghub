/**
 * Error Handling Utilities Tests
 * Tests for lib/api/error-handling.ts
 * 
 * Run: npm test error-handling
 */

import { describe, it, expect } from 'vitest'
import {
  isAbortError,
  isTableNotFoundError,
  createErrorResponse,
  type ApiError,
} from '@/lib/api/error-handling'

describe('Error Handling Utilities', () => {
  describe('isAbortError()', () => {
    it('should detect AbortError by name', () => {
      const error = { name: 'AbortError' }
      expect(isAbortError(error)).toBe(true)
    })

    it('should detect AbortError in message', () => {
      const error = { message: 'Request failed: AbortError' }
      expect(isAbortError(error)).toBe(true)
    })

    it('should detect abort signal in message', () => {
      const error = { message: 'signal is aborted' }
      expect(isAbortError(error)).toBe(true)
    })

    it('should detect AbortError in details', () => {
      const error = { details: 'AbortError occurred' }
      expect(isAbortError(error)).toBe(true)
    })

    it('should return false for non-abort errors', () => {
      expect(isAbortError({ message: 'Network error' })).toBe(false)
      expect(isAbortError({ name: 'TypeError' })).toBe(false)
      expect(isAbortError(null)).toBe(false)
      expect(isAbortError(undefined)).toBe(false)
    })
  })

  describe('isTableNotFoundError()', () => {
    it('should detect PostgreSQL relation error code', () => {
      const error: ApiError = { code: '42P01' }
      expect(isTableNotFoundError(error)).toBe(true)
    })

    it('should detect PostgREST error code', () => {
      const error: ApiError = { code: 'PGRST116' }
      expect(isTableNotFoundError(error)).toBe(true)
    })

    it('should detect 404 status code as string', () => {
      const error: ApiError = { code: '404' }
      expect(isTableNotFoundError(error)).toBe(true)
    })

    it('should detect 404 status code as number', () => {
      const error: ApiError = { code: 404 }
      expect(isTableNotFoundError(error)).toBe(true)
    })

    it('should detect "relation" in error message', () => {
      const error: ApiError = { message: 'relation "table_name" does not exist' }
      expect(isTableNotFoundError(error)).toBe(true)
    })

    it('should detect "does not exist" in error message', () => {
      const error: ApiError = { message: 'Table does not exist' }
      expect(isTableNotFoundError(error)).toBe(true)
    })

    it('should detect "table_fields" in error message', () => {
      const error: ApiError = { message: 'table_fields relation error' }
      expect(isTableNotFoundError(error)).toBe(true)
    })

    it('should detect "Table not found" in error message', () => {
      const error: ApiError = { message: 'Table not found' }
      expect(isTableNotFoundError(error)).toBe(true)
    })

    it('should detect errors in details field', () => {
      const error: ApiError = { details: 'relation does not exist' }
      expect(isTableNotFoundError(error)).toBe(true)
    })

    it('should return false for other errors', () => {
      const error: ApiError = { message: 'Permission denied' }
      expect(isTableNotFoundError(error)).toBe(false)
    })

    it('should handle empty error objects', () => {
      const error: ApiError = {}
      expect(isTableNotFoundError(error)).toBe(false)
    })
  })

  describe('createErrorResponse()', () => {
    it('should create error response with error message', () => {
      const error = { message: 'Custom error message' }
      const response = createErrorResponse(error, 'Default message', 500)
      
      expect(response).toEqual({
        error: 'Custom error message',
      })
    })

    it('should use default message when error.message is missing', () => {
      const error = {}
      const response = createErrorResponse(error, 'Default message', 500)
      
      expect(response).toEqual({
        error: 'Default message',
      })
    })

    it('should use error.error field if message is missing', () => {
      const error = { error: 'Error field message' }
      const response = createErrorResponse(error, 'Default message', 500)
      
      expect(response).toEqual({
        error: 'Error field message',
      })
    })

    it('should include code in response if present', () => {
      const error = { message: 'Error', code: 'ERR001' }
      const response = createErrorResponse(error, 'Default', 500)
      
      expect(response).toEqual({
        error: 'Error',
        code: 'ERR001',
      })
    })

    it('should include details in response if present', () => {
      const error = { message: 'Error', details: 'Detailed error information' }
      const response = createErrorResponse(error, 'Default', 500)
      
      expect(response).toEqual({
        error: 'Error',
        details: 'Detailed error information',
      })
    })

    it('should include both code and details', () => {
      const error = {
        message: 'Error',
        code: 'ERR001',
        details: 'Details',
      }
      const response = createErrorResponse(error, 'Default', 500)
      
      expect(response).toEqual({
        error: 'Error',
        code: 'ERR001',
        details: 'Details',
      })
    })

    it('should handle numeric error codes', () => {
      const error = { message: 'Error', code: 500 }
      const response = createErrorResponse(error, 'Default', 500)
      
      expect(response).toEqual({
        error: 'Error',
        code: 500,
      })
    })

    it('should handle null/undefined errors', () => {
      const response1 = createErrorResponse(null, 'Default message', 500)
      expect(response1).toEqual({ error: 'Default message' })

      const response2 = createErrorResponse(undefined, 'Default message', 500)
      expect(response2).toEqual({ error: 'Default message' })
    })

    it('should use default status code parameter (not used in response but for consistency)', () => {
      const error = { message: 'Error' }
      const response = createErrorResponse(error, 'Default', 400)
      // Status code is not included in response object, but parameter exists for consistency
      expect(response.error).toBe('Error')
    })
  })
})
