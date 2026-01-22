# Pre-Deploy Checklist - Connection Exhaustion Fix

## ✅ A. Cache Invalidation on Schema Change (Future Enhancement)

### Current Status
**Field mutations do NOT currently invalidate the view metadata cache.**

When fields are created, renamed, or deleted, the `useViewMeta` cache is not cleared. This means:
- New fields won't appear in views until cache expires (5 minutes) or page refresh
- Renamed fields may show stale names
- Deleted fields may still appear until cache expires

### Future Implementation Options

#### Option 1: Explicit Cache Clearing (Recommended)
Add cache invalidation to field mutation endpoints:

```typescript
// In POST/PATCH/DELETE handlers for /api/tables/[tableId]/fields
import { clearViewMetaCache } from '@/hooks/useViewMeta'

// After successful mutation:
clearViewMetaCache(undefined, params.tableId) // Clear all views for this table
```

#### Option 2: Cache-Control Headers
Add `Cache-Control: no-store` to field mutation responses:

```typescript
return NextResponse.json({ field: fieldData }, {
  headers: {
    'Cache-Control': 'no-store'
  }
})
```

#### Option 3: Schema Version Header
Bump a `X-Schema-Version` header on mutations, and check it in `useViewMeta`:

```typescript
// In mutation response
return NextResponse.json({ field: fieldData }, {
  headers: {
    'X-Schema-Version': Date.now().toString()
  }
})

// In useViewMeta hook
const schemaVersion = response.headers.get('X-Schema-Version')
if (schemaVersion && cached.schemaVersion !== schemaVersion) {
  // Invalidate cache
}
```

**Priority:** Low (cache expires in 5 minutes anyway, and page refresh clears it)

---

## ✅ B. Auth-Aware Caching (Already Handled)

### Current Implementation
**✅ Auth-aware caching is already handled correctly.**

The Supabase client uses cookies for authentication:
- `createBrowserClient` from `@supabase/ssr` automatically includes auth cookies
- Each user's requests include their session cookie
- Browser naturally partitions cache by cookies/auth headers

### Verification
- ✅ Client-side: `createBrowserClient` includes cookies automatically
- ✅ Server-side: `createServerClient` uses `cookies()` from Next.js
- ✅ Requests include `sb-<project>-auth-token` cookie
- ✅ Different users get different cached responses

**No action needed** - the platform naturally partitions cache by auth session.

---

## 🔍 Pre-Deploy Checklist (10 minutes)

### 1. Network Tab Verification

#### Steps:
1. Open browser DevTools → Network tab
2. Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
3. Load a page with grids/calendars/kanban views
4. Navigate between views 2-3 times

#### Expected Results:
- ✅ `/view_fields`, `/view_filters`, `/view_sorts` return `200` (from disk cache or memory cache)
- ✅ Repeated navigations show `(disk cache)` or `(memory cache)` in Network tab
- ✅ No duplicate requests for the same metadata
- ✅ Total request count is small (< 10 requests per page load)
- ✅ No `ERR_INSUFFICIENT_RESOURCES` errors

#### Red Flags:
- ❌ Same endpoint called multiple times
- ❌ All requests show `200` without cache indicators
- ❌ Request count > 20 per page load
- ❌ `ERR_INSUFFICIENT_RESOURCES` errors

---

### 2. Server Logs Verification

#### Steps:
1. Check Supabase dashboard → Logs
2. Monitor during page loads
3. Count database queries for metadata endpoints

#### Expected Results:
- ✅ `view_fields` query count drops sharply after first load
- ✅ `view_filters` query count drops sharply after first load
- ✅ `view_sorts` query count drops sharply after first load
- ✅ No retry storms (multiple identical queries in quick succession)
- ✅ Query count per page load < 5 for metadata

#### Red Flags:
- ❌ Same query executed multiple times per page load
- ❌ Query count increases with each navigation
- ❌ Retry storms visible in logs

---

### 3. Failure Test (DB Hiccup Simulation)

#### Steps:
1. Temporarily block Supabase requests (use browser DevTools → Network → Block request)
2. Load a page that was previously cached
3. Try to navigate between views
4. Re-enable requests

#### Expected Results:
- ✅ Cached responses still serve (if available)
- ✅ UI degrades gracefully (shows loading state, not blank)
- ✅ No data wipeouts (existing data remains visible)
- ✅ Error messages are user-friendly
- ✅ After re-enabling, page recovers without refresh

#### Red Flags:
- ❌ UI shows blank/white screen
- ❌ Existing data disappears
- ❌ Infinite loading spinner
- ❌ Page requires manual refresh to recover

---

### 4. Dev Console Warnings Check

#### Steps:
1. Open browser DevTools → Console
2. Load pages with views
3. Navigate between views

#### Expected Results:
- ✅ No `[useViewMeta] Deduplicated concurrent request` warnings (or very few)
- ✅ No `[loadRows] Metadata missing` warnings
- ✅ No network errors
- ✅ No React warnings about missing dependencies

#### Red Flags:
- ❌ Frequent `[useViewMeta] Deduplicated concurrent request` warnings
- ❌ `[loadRows] Metadata missing` warnings appearing
- ❌ Network errors in console

---

### 5. Performance Metrics

#### Steps:
1. Open DevTools → Performance tab
2. Record page load
3. Check timing metrics

#### Expected Results:
- ✅ Time to Interactive < 3 seconds
- ✅ First Contentful Paint < 1.5 seconds
- ✅ No long tasks (> 50ms) during metadata loading
- ✅ Network requests complete in < 500ms (cached) or < 2s (uncached)

#### Red Flags:
- ❌ Time to Interactive > 5 seconds
- ❌ Long tasks during metadata loading
- ❌ Network requests taking > 3 seconds

---

### 6. Cross-User Cache Isolation Test

#### Steps:
1. Open page in Incognito window (User A)
2. Open same page in regular window (User B)
3. Verify both users see correct data

#### Expected Results:
- ✅ User A sees their data
- ✅ User B sees their data
- ✅ No data leakage between users
- ✅ Cache is properly isolated per user

#### Red Flags:
- ❌ User A sees User B's data
- ❌ Cache shared between users
- ❌ Auth errors

---

## Quick Test Script

Run this in browser console after loading a page:

```javascript
// Check cache status
const cacheKeys = performance.getEntriesByType('resource')
  .filter(r => r.name.includes('view_fields') || r.name.includes('view_filters') || r.name.includes('view_sorts'))
  .map(r => ({
    url: r.name,
    cached: r.transferSize === 0,
    size: r.transferSize
  }))

console.table(cacheKeys)

// Check for duplicate requests
const requests = performance.getEntriesByType('resource')
  .map(r => r.name)
  .filter(n => n.includes('view_'))

const duplicates = requests.filter((item, index) => requests.indexOf(item) !== index)
if (duplicates.length > 0) {
  console.warn('Duplicate requests detected:', duplicates)
} else {
  console.log('✅ No duplicate requests')
}
```

---

## Sign-Off Checklist

Before deploying, confirm:

- [ ] Network tab shows cached responses
- [ ] Server logs show reduced query count
- [ ] Failure test passes (graceful degradation)
- [ ] No console warnings
- [ ] Performance metrics acceptable
- [ ] Cross-user cache isolation works
- [ ] No `ERR_INSUFFICIENT_RESOURCES` errors
- [ ] Page loads reliably without flicker

---

## Post-Deploy Monitoring

Monitor for 24 hours after deployment:

1. **Error rates**: Check for `ERR_INSUFFICIENT_RESOURCES` in error tracking
2. **Performance**: Monitor page load times
3. **User reports**: Watch for "loading forever" or "blank page" reports
4. **Server load**: Monitor database query counts

If issues arise, cache can be disabled by:
- Setting `CACHE_TTL = 0` in `useViewMeta.ts`
- Or clearing cache on every request (not recommended)

