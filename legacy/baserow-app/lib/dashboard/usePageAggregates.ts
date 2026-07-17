/**
 * Page-level hook to collect and fetch all aggregate requests from blocks
 * 
 * Architecture: Pages fetch aggregates once, blocks consume via props
 * This eliminates duplicate requests from multiple blocks
 */

import { useMemo } from 'react'
import useSWR from 'swr'
import type { AggregateRequest } from './useAggregateData'
import type { PageBlock } from '@/lib/interface/types'
import type { FilterConfig } from '@/lib/interface/filters'
import { mergeFilters } from '@/lib/interface/filters'

export interface AggregateDataMap {
  [blockId: string]: {
    data: any
    error: string | null
    isLoading: boolean
  }
}

/**
 * Extract aggregate requests from blocks
 */
type PageFiltersResolver = FilterConfig[] | ((blockId: string) => FilterConfig[])

function extractAggregateRequests(
  blocks: PageBlock[],
  pageFilters: PageFiltersResolver
): Map<string, AggregateRequest> {
  const requests = new Map<string, AggregateRequest>()
  
  for (const block of blocks) {
    if (block.type !== 'kpi') continue
    
    const config = block.config || {}
    const tableId = config.table_id
    if (!tableId) continue
    
    const aggregate = config.kpi_aggregate || 'count'
    const fieldName = config.kpi_field
    const blockFilters = config.filters || []
    const resolvedPageFilters = typeof pageFilters === 'function' ? pageFilters(block.id) : pageFilters
    const allFilters = mergeFilters(blockFilters, resolvedPageFilters, [])
    
    const comparison = config.comparison ? {
      dateFieldName: config.comparison.date_field,
      currentStart: config.comparison.current_start,
      currentEnd: config.comparison.current_end,
      previousStart: config.comparison.previous_start,
      previousEnd: config.comparison.previous_end,
    } : undefined
    
    // Create request key from block ID
    requests.set(block.id, {
      tableId,
      aggregate,
      fieldName,
      filters: allFilters,
      comparison,
    })
  }
  
  return requests
}

/**
 * Batch fetcher for multiple aggregate requests
 */
async function batchAggregateFetcher(requests: AggregateRequest[]): Promise<any[]> {
  if (requests.length === 0) return []
  
  const response = await fetch('/api/dashboard/aggregate-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to aggregate data' }))
    throw new Error(error.error || 'Failed to aggregate data')
  }

  const data = await response.json()
  return data.results || []
}

/**
 * Hook to fetch all aggregates for a page's blocks
 * 
 * Returns a map of blockId -> aggregate data
 * Uses batch API to fetch all requests in parallel
 * SWR handles caching and deduplication
 */
export function usePageAggregates(
  blocks: PageBlock[],
  pageFilters: PageFiltersResolver = []
): AggregateDataMap {
  // Extract all aggregate requests from KPI blocks
  const requests = useMemo(() => {
    return extractAggregateRequests(blocks, pageFilters)
  }, [blocks, pageFilters])
  
  // Group requests by their parameters to deduplicate
  // Multiple blocks with same params will share the same result
  const requestGroups = useMemo(() => {
    const groups = new Map<string, { blockIds: string[], request: AggregateRequest, index: number }>()
    let index = 0
    
    for (const [blockId, request] of requests.entries()) {
      const key = JSON.stringify(request)
      if (!groups.has(key)) {
        groups.set(key, { blockIds: [], request, index: index++ })
      }
      groups.get(key)!.blockIds.push(blockId)
    }
    
    return Array.from(groups.values())
  }, [requests])
  
  // Create stable array of unique requests for batch fetch
  const uniqueRequests = useMemo(() => {
    return requestGroups.map(({ request }) => request)
  }, [requestGroups])
  
  // Generate stable cache key
  const cacheKey = useMemo(() => {
    if (uniqueRequests.length === 0) return null
    return `aggregate-batch:${JSON.stringify(uniqueRequests)}`
  }, [uniqueRequests])
  
  // Fetch all aggregates in a single batch request
  // SWR handles caching and deduplication
  const { data: batchResults, error, isLoading } = useSWR<any[]>(
    cacheKey,
    () => batchAggregateFetcher(uniqueRequests),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  )
  
  // Build aggregate map from batch results - memoized to prevent React #185 (re-render cascades)
  const aggregateMap = useMemo(() => {
    const map: AggregateDataMap = {}
    if (batchResults) {
      requestGroups.forEach(({ blockIds, index }) => {
        const result = batchResults[index]
        const resultData = result?.error ? null : result
        const resultError = result?.error || null
        blockIds.forEach(blockId => {
          map[blockId] = {
            data: resultData,
            error: resultError,
            isLoading: false,
          }
        })
      })
    } else {
      requestGroups.forEach(({ blockIds }) => {
        blockIds.forEach(blockId => {
          map[blockId] = {
            data: null,
            error: error ? (error as Error).message : null,
            isLoading,
          }
        })
      })
    }
    return map
  }, [batchResults, requestGroups, error, isLoading])

  return aggregateMap
}
