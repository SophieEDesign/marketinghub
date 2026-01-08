/**
 * Server-side in-memory cache for dashboard aggregates
 * 
 * Simple Map-based cache with TTL (Time To Live)
 * Deduplicates concurrent requests for the same data
 */

interface CacheEntry {
  data: any
  timestamp: number
  promise?: Promise<any> // For deduplicating concurrent requests
}

const CACHE_TTL_MS = 5000 // 5 seconds cache
const cache = new Map<string, CacheEntry>()

/**
 * Generate cache key from request parameters
 */
function getCacheKey(params: {
  tableId: string
  aggregate: string
  fieldName?: string
  filters?: any[]
  comparison?: any
}): string {
  return JSON.stringify({
    tableId: params.tableId,
    aggregate: params.aggregate,
    fieldName: params.fieldName || null,
    filters: params.filters || [],
    comparison: params.comparison || null,
  })
}

/**
 * Get cached data if available and not expired
 */
export function getCachedAggregate(params: {
  tableId: string
  aggregate: string
  fieldName?: string
  filters?: any[]
  comparison?: any
}): any | null {
  const key = getCacheKey(params)
  const entry = cache.get(key)
  
  if (!entry) return null
  
  // Check if expired
  const age = Date.now() - entry.timestamp
  if (age > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  
  return entry.data
}

/**
 * Cache aggregate result
 */
export function setCachedAggregate(
  params: {
    tableId: string
    aggregate: string
    fieldName?: string
    filters?: any[]
    comparison?: any
  },
  data: any
): void {
  const key = getCacheKey(params)
  cache.set(key, {
    data,
    timestamp: Date.now(),
  })
  
  // Clean up expired entries periodically (every 10 seconds)
  if (Math.random() < 0.1) { // 10% chance on each set
    cleanupExpiredEntries()
  }
}

/**
 * Get or create a promise for concurrent request deduplication
 * If a request is already in flight, return the existing promise
 */
export function getOrCreatePromise<T>(
  params: {
    tableId: string
    aggregate: string
    fieldName?: string
    filters?: any[]
    comparison?: any
  },
  fetcher: () => Promise<T>
): Promise<T> {
  const key = getCacheKey(params)
  const entry = cache.get(key)
  
  // If there's an in-flight promise, return it
  if (entry?.promise) {
    return entry.promise
  }
  
  // Create new promise and cache it
  const promise = fetcher().then((data) => {
    // Cache the result
    setCachedAggregate(params, data)
    
    // Remove promise from entry (request completed)
    const currentEntry = cache.get(key)
    if (currentEntry) {
      delete currentEntry.promise
    }
    
    return data
  }).catch((error) => {
    // Remove promise on error
    const currentEntry = cache.get(key)
    if (currentEntry) {
      delete currentEntry.promise
    }
    throw error
  })
  
  // Store promise in cache for deduplication
  cache.set(key, {
    data: null,
    timestamp: Date.now(),
    promise,
  })
  
  return promise
}

/**
 * Clean up expired cache entries
 */
function cleanupExpiredEntries(): void {
  const now = Date.now()
  for (const [key, entry] of cache.entries()) {
    const age = now - entry.timestamp
    if (age > CACHE_TTL_MS && !entry.promise) {
      // Only delete if not an in-flight request
      cache.delete(key)
    }
  }
}

/**
 * Clear all cache entries (useful for testing)
 */
export function clearAggregateCache(): void {
  cache.clear()
}
