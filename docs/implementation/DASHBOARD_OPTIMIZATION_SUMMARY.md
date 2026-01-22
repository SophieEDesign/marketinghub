# Dashboard Aggregate Optimization Summary

## Overview
Refactored dashboard aggregate data fetching to eliminate excessive requests, reduce page load time, and prevent duplicate data fetching across dashboard blocks.

## Architecture Changes

### Before
- Each KPI block independently called `/api/dashboard/aggregate`
- Resulted in hundreds of duplicate requests per page load
- No request deduplication
- No caching layer

### After
- **Page-level data fetching**: Aggregates are fetched once at the page level (in `Canvas` component)
- **Blocks are presentational**: KPI blocks receive data via props, no direct API calls
- **Request deduplication**: SWR automatically deduplicates requests with same parameters
- **Server-side caching**: 5-second in-memory cache with concurrent request deduplication
- **Batch API**: New `/api/dashboard/aggregate-batch` endpoint processes multiple requests in parallel

## Files Changed

### New Files
1. **`lib/dashboard/useAggregateData.ts`**
   - SWR hook for fetching individual aggregate requests
   - Automatic deduplication via SWR cache keys

2. **`lib/dashboard/usePageAggregates.ts`**
   - Page-level hook that collects all KPI block requests
   - Groups requests by parameters to deduplicate
   - Uses batch API to fetch all aggregates in parallel

3. **`lib/dashboard/aggregateCache.ts`**
   - Server-side in-memory cache (5-second TTL)
   - Deduplicates concurrent requests for same parameters
   - Automatic cleanup of expired entries

4. **`app/api/dashboard/aggregate-batch/route.ts`**
   - New batch endpoint for fetching multiple aggregates
   - Processes requests in parallel using `Promise.all`
   - Uses same caching layer as single aggregate endpoint

5. **`components/providers/SWRProvider.tsx`**
   - SWR configuration provider
   - Wraps app to enable SWR hooks throughout

### Modified Files
1. **`app/api/dashboard/aggregate/route.ts`**
   - Added server-side caching using `aggregateCache.ts`
   - Deduplicates concurrent requests
   - Returns cache headers (`X-Cache: HIT/MISS`)

2. **`components/interface/blocks/KPIBlock.tsx`**
   - Removed direct API calls (`fetch('/api/dashboard/aggregate')`)
   - Now receives `aggregateData` prop from parent
   - Purely presentational component

3. **`components/interface/Canvas.tsx`**
   - Fetches all aggregates at page level using `usePageAggregates`
   - Passes aggregate data to `BlockRenderer` for each block

4. **`components/interface/BlockRenderer.tsx`**
   - Receives `aggregateData` prop
   - Passes to KPI blocks

5. **`components/interface/InterfaceBuilder.tsx`**
   - Removed aggregate fetching (moved to Canvas)
   - Simplified component

6. **`components/interface/InterfacePageClient.tsx`**
   - Parallelized page boot requests using `Promise.all`
   - Blocks and page data load in parallel when possible

7. **`app/layout.tsx`**
   - Added `SWRProvider` wrapper

8. **`package.json`**
   - Added `swr` dependency

## How Aggregate Requests Are Deduplicated

### Client-Side (SWR)
1. **Stable Cache Keys**: Each aggregate request generates a stable key from its parameters:
   ```typescript
   `aggregate:${JSON.stringify({ tableId, aggregate, fieldName, filters, comparison })}`
   ```

2. **Automatic Deduplication**: SWR deduplicates requests with the same key within 5 seconds (`dedupingInterval: 5000`)

3. **Request Grouping**: `usePageAggregates` groups blocks with identical request parameters, so multiple blocks share the same SWR cache entry

### Server-Side (In-Memory Cache)
1. **Cache Key Generation**: Same parameter-based key generation
2. **TTL**: 5-second cache lifetime
3. **Concurrent Request Deduplication**: `getOrCreatePromise` ensures multiple concurrent requests for the same data share a single promise
4. **Automatic Cleanup**: Expired entries are cleaned up periodically

## Where Caching Occurs

### Client-Side (SWR)
- **Location**: Browser memory (via SWR cache)
- **Duration**: 5 seconds (`dedupingInterval`)
- **Scope**: Per-page session
- **Benefits**: Instant data for duplicate requests, reduced network traffic

### Server-Side (In-Memory Cache)
- **Location**: Node.js server memory (`Map` in `aggregateCache.ts`)
- **Duration**: 5 seconds (configurable via `CACHE_TTL_MS`)
- **Scope**: All requests to the same server instance
- **Benefits**: Reduced database queries, faster response times

## Performance Improvements

### Request Reduction
- **Before**: N requests for N KPI blocks (even if identical)
- **After**: 1 request per unique parameter combination (via SWR + batch API)

### Page Load Time
- **Before**: Sequential requests, ~978ms average, up to 2s
- **After**: Parallel batch requests, expected ~200-400ms for typical dashboards

### Database Load
- **Before**: Every request hits database
- **After**: Cached requests skip database (5-second window)

## Architecture Principles

1. **Pages Fetch Data**: `Canvas` component fetches all aggregates
2. **Blocks Render UI**: KPI blocks are purely presentational
3. **Deduplication at Multiple Layers**: SWR (client) + cache (server)
4. **Batch Processing**: Multiple requests in single API call
5. **Stale Data Tolerance**: 5-10 second staleness acceptable for dashboard data

## Testing Recommendations

1. **Monitor Request Count**: Check Network tab - should see 1 batch request instead of N individual requests
2. **Verify Caching**: Check `X-Cache` headers in response
3. **Test Filter Changes**: Ensure filters update aggregate data correctly
4. **Load Performance**: Measure page load time improvements
5. **Concurrent Requests**: Test multiple tabs loading same dashboard simultaneously

## Migration Notes

- **Backward Compatibility**: KPI blocks still work if `aggregateData` prop is not provided (shows loading state)
- **No Breaking Changes**: API endpoints remain compatible
- **Gradual Rollout**: Can deploy incrementally, old blocks continue to work

## Future Optimizations

1. **Redis Cache**: Replace in-memory cache with Redis for multi-instance deployments
2. **Longer Cache TTL**: Increase to 10 seconds if data staleness tolerance allows
3. **Request Batching**: Extend batch API to other endpoints (charts, tables)
4. **Prefetching**: Prefetch aggregates for linked pages
5. **Query Optimization**: Review database queries in `aggregations.ts` for further optimization
