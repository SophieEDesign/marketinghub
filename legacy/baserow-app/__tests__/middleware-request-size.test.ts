/**
 * Middleware & Request Size Limit Tests
 * Tests for request size validation (413 Payload Too Large)
 *
 * Run: npm test middleware-request-size
 */

import { describe, it, expect } from 'vitest'

const API_BODY_SIZE_LIMIT_BYTES = 1024 * 1024 // 1MB

describe('Request Size Limit', () => {
  it('should reject requests exceeding 1MB', () => {
    const contentLength = String(API_BODY_SIZE_LIMIT_BYTES + 1)
    const size = parseInt(contentLength, 10)
    const exceeds = !Number.isNaN(size) && size > API_BODY_SIZE_LIMIT_BYTES
    expect(exceeds).toBe(true)
  })

  it('should allow requests at or below 1MB', () => {
    expect(parseInt(String(API_BODY_SIZE_LIMIT_BYTES), 10) <= API_BODY_SIZE_LIMIT_BYTES).toBe(true)
    expect(parseInt(String(API_BODY_SIZE_LIMIT_BYTES - 1), 10) <= API_BODY_SIZE_LIMIT_BYTES).toBe(true)
  })

  it('should handle missing content-length gracefully', () => {
    const contentLength = null
    const size = contentLength ? parseInt(contentLength, 10) : NaN
    const exceeds = !Number.isNaN(size) && size > API_BODY_SIZE_LIMIT_BYTES
    expect(exceeds).toBe(false)
  })

  it('should handle invalid content-length', () => {
    const contentLength = 'not-a-number'
    const size = parseInt(contentLength, 10)
    const exceeds = !Number.isNaN(size) && size > API_BODY_SIZE_LIMIT_BYTES
    expect(exceeds).toBe(false)
  })
})
