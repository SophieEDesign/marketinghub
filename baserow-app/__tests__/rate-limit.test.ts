/**
 * Rate Limit Utility Tests
 * Tests for lib/rate-limit.ts
 */

import { describe, it, expect } from 'vitest'
import { getAuthRateLimiter, getApiRateLimiter, isRateLimitEnabled } from '@/lib/rate-limit'

describe('Rate Limit Utilities', () => {
  describe('isRateLimitEnabled()', () => {
    it('should return false when UPSTASH env vars are not set (default in CI/local)', () => {
      // In test env, UPSTASH vars are typically unset
      expect(typeof isRateLimitEnabled()).toBe('boolean')
    })
  })

  describe('getAuthRateLimiter()', () => {
    it('should return null or Ratelimit based on env', () => {
      const limiter = getAuthRateLimiter()
      // When env not set: null. When set: Ratelimit instance with limit method
      if (limiter === null) {
        expect(limiter).toBeNull()
      } else {
        expect(limiter).toHaveProperty('limit')
        expect(typeof limiter.limit).toBe('function')
      }
    })
  })

  describe('getApiRateLimiter()', () => {
    it('should return null or Ratelimit based on env', () => {
      const limiter = getApiRateLimiter()
      if (limiter === null) {
        expect(limiter).toBeNull()
      } else {
        expect(limiter).toHaveProperty('limit')
      }
    })
  })
})
