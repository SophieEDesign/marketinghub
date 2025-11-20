/**
 * Global Metadata Cache
 * Lightweight in-memory cache for frequently accessed metadata
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl?: number; // Time to live in milliseconds
}

const metadataCache = new Map<string, CacheEntry<any>>();

// Default TTL: 5 minutes
const DEFAULT_TTL = 5 * 60 * 1000;

/**
 * Get cached value by key
 */
export function getCached<T>(key: string): T | null {
  const entry = metadataCache.get(key);
  if (!entry) return null;

  // Check if expired
  if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
    metadataCache.delete(key);
    return null;
  }

  return entry.value as T;
}

/**
 * Set cached value
 */
export function setCached<T>(key: string, value: T, ttl?: number): void {
  metadataCache.set(key, {
    value,
    timestamp: Date.now(),
    ttl: ttl || DEFAULT_TTL,
  });
}

/**
 * Get cached value or fetch if not available
 */
export async function getOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== null) {
    return cached;
  }

  const value = await fetchFn();
  setCached(key, value, ttl);
  return value;
}

/**
 * Invalidate cache entry
 */
export function invalidateCache(key: string): void {
  metadataCache.delete(key);
}

/**
 * Invalidate all cache entries matching a pattern
 */
export function invalidateCachePattern(pattern: string): void {
  const regex = new RegExp(pattern);
  for (const key of metadataCache.keys()) {
    if (regex.test(key)) {
      metadataCache.delete(key);
    }
  }
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  metadataCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: metadataCache.size,
    keys: Array.from(metadataCache.keys()),
  };
}

// Cache key generators
export const CacheKeys = {
  fields: (tableId: string) => `fields:${tableId}`,
  viewSettings: (tableId: string, viewId: string) => `viewSettings:${tableId}:${viewId}`,
  campaigns: () => "campaigns:all",
  contacts: () => "contacts:all",
  contentStatuses: () => "content:statuses",
  channelOptions: () => "channels:options",
  selectOptions: (tableId: string, fieldKey: string) => `selectOptions:${tableId}:${fieldKey}`,
  tableRecords: (tableId: string, filters?: string) => 
    filters ? `records:${tableId}:${filters}` : `records:${tableId}:all`,
};

