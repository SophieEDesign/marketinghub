/**
 * Rate limiting using Upstash Redis.
 * When UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set, rate limiting is active.
 * When not set, all requests are allowed (graceful degradation for local dev).
 */

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

/** Stricter limit for auth-sensitive routes: 5 requests per 15 minutes per identifier */
export function getAuthRateLimiter() {
  const redis = getRedis()
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(5, "15 m"),
    analytics: true,
  })
}

/** General API limit: 100 requests per minute per identifier */
export function getApiRateLimiter() {
  const redis = getRedis()
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(100, "1 m"),
    analytics: true,
  })
}

export function isRateLimitEnabled(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}
