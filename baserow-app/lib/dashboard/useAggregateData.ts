/**
 * Page-level aggregate data fetching hook
 * Uses SWR for automatic request deduplication and caching
 * 
 * Architecture: Pages fetch aggregates, blocks consume via props
 */

import useSWR from 'swr'
import type { AggregateFunction, AggregationResult, ComparisonResult } from './aggregations'
import type { FilterConfig } from '@/lib/interface/filters'

export interface AggregateRequest {
  tableId: string
  aggregate: AggregateFunction
  fieldName?: string
  filters?: FilterConfig[]
  comparison?: {
    dateFieldName: string
    currentStart: string
    currentEnd: string
    previousStart: string
    previousEnd: string
  }
}

export interface AggregateResponse extends AggregationResult {
  comparison?: ComparisonResult
}

/**
 * Fetcher function for SWR
 */
async function aggregateFetcher(request: AggregateRequest): Promise<AggregateResponse> {
  const response = await fetch('/api/dashboard/aggregate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tableId: request.tableId,
      aggregate: request.aggregate,
      fieldName: request.fieldName,
      filters: request.filters,
      comparison: request.comparison,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to aggregate data' }))
    throw new Error(error.error || 'Failed to aggregate data')
  }

  return response.json()
}

/**
 * Generate a stable cache key for an aggregate request
 * Same request parameters = same key = deduplicated request
 */
function getAggregateKey(request: AggregateRequest | null): string | null {
  if (!request) return null
  
  // Create stable key from request parameters
  const key = JSON.stringify({
    tableId: request.tableId,
    aggregate: request.aggregate,
    fieldName: request.fieldName || null,
    filters: request.filters || [],
    comparison: request.comparison || null,
  })
  
  return `aggregate:${key}`
}

/**
 * Hook to fetch aggregate data with automatic deduplication
 * 
 * Usage:
 * ```tsx
 * const { data, error, isLoading } = useAggregateData({
 *   tableId: '...',
 *   aggregate: 'count',
 *   filters: [...],
 * })
 * ```
 */
export function useAggregateData(request: AggregateRequest | null) {
  const key = getAggregateKey(request)
  
  // Use SWR with 5 second stale time (data can be stale for 5s)
  // This prevents refetching on every render
  const { data, error, isLoading, mutate } = useSWR<AggregateResponse>(
    key,
    request ? () => aggregateFetcher(request) : null,
    {
      revalidateOnFocus: false, // Don't refetch on window focus
      revalidateOnReconnect: false, // Don't refetch on reconnect
      dedupingInterval: 5000, // Deduplicate requests within 5 seconds
      keepPreviousData: true, // Keep previous data while loading new data
    }
  )

  return {
    data: data || null,
    error: error ? (error as Error).message : null,
    isLoading,
    mutate, // Allow manual refresh if needed
  }
}
