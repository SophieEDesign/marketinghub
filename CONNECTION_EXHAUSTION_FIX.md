# Connection Exhaustion Fix - Implementation Summary

## Problem Diagnosed

The application was experiencing `ERR_INSUFFICIENT_RESOURCES` errors due to:
1. **Uncontrolled parallel requests**: Multiple components loading view metadata (`view_fields`, `view_filters`, `view_sorts`) simultaneously using `Promise.all`
2. **Metadata reloading on row fetches**: `loadRows()` function was fetching metadata every time rows were loaded
3. **No caching**: Metadata was reloaded repeatedly even when it hadn't changed
4. **Cascading retries**: Network failures triggered automatic retries, causing request storms

## Root Cause

The browser was hitting its connection limit (typically 6-10 concurrent connections per domain) because:
- Multiple components were loading the same metadata in parallel
- Row loading was triggering metadata reloads
- No deduplication or caching mechanism existed
- Failed requests were retrying automatically, creating cascading failures

## Solution Implemented

### 1. Created `useViewMeta` Hook (`baserow-app/hooks/useViewMeta.ts`)

**Key Features:**
- **Global cache**: Prevents duplicate requests across components using a Map-based cache
- **Serialized requests**: Loads fields → filters → sorts sequentially (not in parallel)
- **Cache TTL**: 5-minute cache expiration
- **Promise deduplication**: If a request is in-flight, other components wait for it
- **No automatic retries**: On network failure, keeps existing cached data instead of retrying

**Usage:**
```typescript
const { metadata, loading, error } = useViewMeta(viewId, tableId)
// metadata contains: { fields, filters, sorts }
```

### 2. Refactored `loadRows()` Function (`lib/data.ts`)

**Changes:**
- Added optional `filters`, `sorts`, and `visibleFields` parameters
- Only loads metadata if not provided (allows passing cached metadata)
- Serializes metadata requests when they must be loaded (no `Promise.all`)

**Before:**
```typescript
// Loaded metadata in parallel every time rows were fetched
const [filtersRes, sortsRes, fieldsRes] = await Promise.all([...])
```

**After:**
```typescript
// Accepts metadata as parameters, only loads if not provided
export async function loadRows(options: {
  filters?: ViewFilter[]
  sorts?: ViewSort[]
  visibleFields?: ViewField[]
  // ...
})
```

### 3. Updated `GridBlock` Component (`baserow-app/components/interface/blocks/GridBlock.tsx`)

**Changes:**
- Uses `useViewMeta` hook instead of loading metadata directly
- Serializes table and table_fields requests (no parallel `Promise.allSettled`)
- Prevents concurrent loads using refs
- No automatic retries on network failure

**Before:**
```typescript
// Parallel requests for view metadata
const [viewFieldsRes, viewFiltersRes, viewSortsRes, viewRes] = await Promise.allSettled([...])
```

**After:**
```typescript
// Uses cached hook
const { metadata: viewMeta, loading: metaLoading } = useViewMeta(viewId, tableId)
```

### 4. Updated `GridView` Component (`baserow-app/components/views/GridView.tsx`)

**Changes:**
- Uses `useViewMeta` hook instead of separate `loadViewConfig()` function
- Prevents concurrent row loads using refs
- No automatic retries on network failure
- Keeps existing rows on error instead of clearing them

**Before:**
```typescript
// Separate function loading metadata sequentially but no caching
async function loadViewConfig() {
  const { data: viewFilters } = await supabase.from("view_filters")...
  const { data: viewSorts } = await supabase.from("view_sorts")...
}
```

**After:**
```typescript
// Uses cached hook
const { metadata: viewMeta } = useViewMeta(viewId, tableId)
const filters = viewMeta?.filters || []
const sorts = viewMeta?.sorts || []
```

## Key Principles Enforced

### ✅ Phase Separation
1. **Phase 1: View Metadata** (load once, cache aggressively)
   - Fields, filters, sorts
   - Loaded via `useViewMeta` hook
   - Cached globally
   - Never reloaded on row fetches

2. **Phase 2: Row Data** (reloadable)
   - SQL rows, record lists
   - Can reload on filters/search/pagination
   - Does NOT trigger metadata reloads

### ✅ Serialization
- All metadata requests are serialized (fields → filters → sorts)
- No `Promise.all` for metadata requests
- Prevents connection exhaustion

### ✅ Caching
- Global cache prevents duplicate requests
- Cache shared across all components
- 5-minute TTL prevents stale data

### ✅ Failure Handling
- No automatic retries on network failure
- Keeps existing data when errors occur
- Prevents cascading failures

## Expected Results

After these changes:
- ✅ Network tab shows a small, finite set of requests
- ✅ No `ERR_INSUFFICIENT_RESOURCES` errors
- ✅ Page loads once per view
- ✅ Data appears reliably
- ✅ No flicker
- ✅ Refresh works correctly
- ✅ Switching views loads once per view

## Testing Checklist

- [ ] Open browser DevTools Network tab
- [ ] Load a page with a grid view
- [ ] Verify only 3-5 requests for metadata (fields, filters, sorts) - serialized
- [ ] Verify no duplicate requests for the same metadata
- [ ] Verify row loading doesn't trigger metadata reloads
- [ ] Switch views and verify metadata loads once per view
- [ ] Check for `ERR_INSUFFICIENT_RESOURCES` errors (should be none)
- [ ] Verify no infinite loading flicker

## Files Modified

1. `baserow-app/hooks/useViewMeta.ts` - New hook for cached metadata loading
2. `lib/data.ts` - Refactored to accept metadata as parameters
3. `baserow-app/components/interface/blocks/GridBlock.tsx` - Uses cached hook
4. `baserow-app/components/views/GridView.tsx` - Uses cached hook

## Guardrails Added

### 🧯 Guardrail 1: Dev-only warning for parallel metadata loads

In `useViewMeta`, a dev-only warning detects concurrent requests:
```typescript
if (process.env.NODE_ENV === 'development') {
  if (inFlightRequests.has(cacheKey)) {
    console.warn('[useViewMeta] Deduplicated concurrent request:', cacheKey)
  }
}
```

**Why:** If someone later reintroduces parallel fetching elsewhere, you'll see it immediately in dev console.

### 🧯 Guardrail 2: Hard rule — rows must NEVER trigger metadata loads

In `loadRows`, a defensive assertion warns if metadata is missing:
```typescript
if (viewId && (!providedFilters || !providedSorts || !providedVisibleFields)) {
  console.warn(
    '[loadRows] Metadata missing — this should be supplied by useViewMeta'
  )
}
```

**Why:** Prevents future regressions when someone "just grabs fields quickly" without using the cached hook.

## Notes

- Server-side pages (`baserow-app/app/tables/[tableId]/views/[viewId]/page.tsx`) still use `Promise.allSettled` but this is less critical since server-side doesn't have browser connection limits
- The cache is in-memory and will reset on page refresh (intentional - ensures fresh data)
- Cache TTL of 5 minutes balances freshness with performance
- Guardrails are dev-only warnings that won't affect production performance

## Future Enhancements

### Cache Invalidation on Schema Changes
Currently, field mutations (create/update/delete) do not invalidate the view metadata cache. This means:
- New fields won't appear until cache expires (5 minutes) or page refresh
- Consider adding `clearViewMetaCache(tableId)` to field mutation endpoints in the future

### Auth-Aware Caching
✅ **Already handled correctly** - Supabase client uses cookies, which naturally partition cache per user session. No changes needed.

See `PRE_DEPLOY_CHECKLIST.md` for detailed testing procedures and future enhancement options.

