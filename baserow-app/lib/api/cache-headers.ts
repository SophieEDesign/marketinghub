/**
 * Cache header utilities for API routes
 */

import { NextResponse } from 'next/server'

/**
 * Cache duration constants (in seconds)
 */
export const CACHE_DURATIONS = {
  SHORT: 30,      // 30 seconds - for frequently changing data
  MEDIUM: 300,    // 5 minutes - for moderately stable data
  LONG: 3600,     // 1 hour - for stable data
  VERY_LONG: 86400, // 24 hours - for very stable data
} as const

/**
 * Add cache headers to a response
 */
export function addCacheHeaders(
  response: NextResponse,
  maxAge: number = CACHE_DURATIONS.SHORT,
  staleWhileRevalidate?: number
): NextResponse {
  const cacheControl = [
    `public`,
    `max-age=${maxAge}`,
    ...(staleWhileRevalidate ? [`stale-while-revalidate=${staleWhileRevalidate}`] : []),
  ].join(', ')

  response.headers.set('Cache-Control', cacheControl)
  return response
}

/**
 * Create a cached JSON response
 */
export function cachedJsonResponse(
  data: any,
  maxAge: number = CACHE_DURATIONS.SHORT,
  staleWhileRevalidate?: number
): NextResponse {
  const response = NextResponse.json(data)
  return addCacheHeaders(response, maxAge, staleWhileRevalidate)
}

