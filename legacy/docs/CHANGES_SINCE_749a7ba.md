# Changes Since Commit 749a7ba

**Base Commit:** `749a7ba` - "Enhance error handling and UI adjustments across components"  
**Current HEAD:** `9d076f1d9d` - "Enhance fetch-wrapper for improved CORS error handling and credential management"  
**Date Range:** January 23, 2026  
**Total Changes:** 7 commits, 26 files changed (+1112 insertions, -263 deletions)

---

## Summary of Commits

1. **ccd1724360** - Improve error handling and sorting functionality across components
2. **254199ac9e** - Implement abort error handling and request management in various components
3. **8feb7dcdc2** - Implement abort error handling in AirtableGridView and WorkspaceTab
4. **3a338b48d6** - Implement required field validation and error handling in GridView and RecordModal
5. **b7bc9f8e3a** - Enhance session management and error handling in ChartBlock and NavigationDiagnostics
6. **e1aac04180** - Fix 401 authentication errors in ChartBlock - add session refresh and proper error handling
7. **9d076f1d9d** - Enhance fetch-wrapper for improved CORS error handling and credential management

---

## New Files Created

### 1. `baserow-app/lib/supabase/fetch-wrapper.ts` (167 lines)
**Purpose:** Enhanced fetch wrapper with retry logic, CORS error detection, and credential management.

**Key Features:**
- Automatic retry on network errors (ERR_CONNECTION_CLOSED, ERR_QUIC_PROTOCOL_ERROR, etc.)
- Exponential backoff with jitter (max 3 retries)
- CORS error detection with helpful console messages
- Credential management (`credentials: 'include'` for Supabase requests)
- Cache control (`cache: 'no-store'` by default)
- HTTP/3 workaround via Connection header

**Dependencies:** None (standalone utility)

### 2. `docs/guides/SUPABASE_CORS_CONFIGURATION.md` (93 lines)
**Purpose:** Documentation guide for configuring Supabase CORS settings.

**Contents:**
- Problem description (wildcard CORS with credentials)
- Step-by-step configuration instructions
- SQL commands for PostgREST CORS configuration
- Dashboard configuration for Auth API
- Troubleshooting tips

**Dependencies:** None (documentation only)

### 3. `supabase/migrations/fix_cors_for_production_domain.sql` (16 lines)
**Purpose:** SQL migration to configure CORS for production domain.

**Contents:**
- ALTER ROLE authenticator SET pgrst.server_cors_allowed_origins
- NOTIFY pgrst,'reload config'
- Verification queries

**Dependencies:** None (SQL migration)

### 4. `supabase/migrations/fix_user_profile_sync_status_security_definer.sql` (40 lines)
**Purpose:** Security definer migration for user profile sync status.

**Dependencies:** None (SQL migration)

---

## Modified Files - Detailed Changes

### Core Infrastructure

#### `baserow-app/lib/supabase/client.ts`
**Change Type:** Fetch wrapper replacement

**Before:**
```typescript
const noStoreFetch: typeof fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  if (init?.cache) return fetch(input, init)
  return fetch(input, { ...(init || {}), cache: "no-store" })
}
```

**After:**
```typescript
import { enhancedFetch } from "./fetch-wrapper";
const noStoreFetch = enhancedFetch
```

**Impact:** All Supabase requests now use enhanced fetch with retries and CORS handling.

#### `lib/supabase.ts`
**Change Type:** Fetch wrapper integration

**Changes:**
- Added import: `import { enhancedFetch } from '../baserow-app/lib/supabase/fetch-wrapper'`
- Updated `createClientSupabaseClient()` to use `enhancedFetch`

**Impact:** Server-side Supabase client also uses enhanced fetch.

---

### Grid Components

#### `baserow-app/components/grid/AirtableGridView.tsx`
**Change Type:** Abort error handling

**Changes:**
- Added import: `import { isAbortError } from '@/lib/api/error-handling'`
- Added abort error checks in two locations:
  1. Grid view settings loading (line ~507)
  2. Column width loading (line ~588)

**Code Pattern:**
```typescript
if (error && error.code !== 'PGRST116') {
  if (isAbortError(error)) return
  console.error('Error loading grid view settings:', error)
  // ... fallback logic
}
```

**Impact:** Prevents console errors from expected abort errors during navigation.

#### `baserow-app/components/grid/AirtableViewPage.tsx`
**Change Type:** Abort error handling

**Changes:**
- Added import: `import { isAbortError } from "@/lib/api/error-handling"`
- Added abort error check in user role loading (line ~146)

**Code Pattern:**
```typescript
} catch (error) {
  if (isAbortError(error)) return
  console.error("Error loading user role:", error)
  // ... fallback
}
```

**Impact:** Reduces console noise from navigation-related errors.

#### `baserow-app/components/grid/GridView.tsx`
**Change Type:** Required field validation + error handling

**Changes:**
1. **Required Field Validation (lines ~2181-2227):**
   - Validates required fields before inserting new rows
   - Checks for empty values (null, undefined, empty string, empty array)
   - Respects default values
   - Shows confirmation dialog if required fields are missing
   - Allows user to proceed anyway (database constraints will enforce)

2. **Enhanced Error Handling (lines ~2233-2249):**
   - Specific handling for PostgreSQL NOT NULL constraint violations (code 23502)
   - User-friendly error messages
   - Alert dialogs for validation errors

**Code Snippet:**
```typescript
// Validate required fields before inserting
const requiredFields = safeTableFields.filter(f => 
  f && typeof f === 'object' && f.required === true && f.name
)

if (requiredFields.length > 0) {
  const missingRequired: string[] = []
  // ... validation logic
  if (missingRequired.length > 0) {
    const proceed = confirm(
      `Warning: The following required fields are empty:\n\n${missingRequired.join('\n')}\n\n` +
      `Do you want to create the record anyway?`
    )
    if (!proceed) return
  }
}

// Enhanced error handling
if (error.code === "23502" || error.message?.includes("null value")) {
  alert(`Cannot create record: Required fields must have values.`)
}
```

**Impact:** Better UX for required field validation, catches errors early.

#### `baserow-app/components/grid/GridViewWrapper.tsx`
**Change Type:** Grouping logic fix

**Changes:**
- Fixed grouping restoration to respect `initialGroupBy` from block config
- Prevents grouping from being restored when removed from block config
- Ensures block config takes precedence over view settings
- Clears `grid_view_settings` when grouping is removed from block

**Key Logic (lines ~274-320):**
```typescript
// If initialGroupBy is null/undefined, clear grid_view_settings
if (initialGroupBy === null || initialGroupBy === undefined) {
  // Clear grouping from grid_view_settings
  await supabase
    .from("grid_view_settings")
    .update({ group_by_rules: null, group_by_field: null })
    .eq("view_id", viewUuid)
  setGroupByRules(undefined)
  setGroupBy(undefined)
  return
}

// Use initialGroupBy if provided (block config takes precedence)
if (initialGroupBy) {
  const rules: GroupRule[] = [{ type: 'field', field: initialGroupBy }]
  setGroupByRules(rules)
  setGroupBy(initialGroupBy)
  return
}

// Only load from grid_view_settings if initialGroupBy not provided
```

**Dependency:** Added `initialGroupBy` to useEffect dependency array.

**Impact:** Fixes grouping behavior when removing grouping from blocks.

#### `baserow-app/components/grid/RecordDrawer.tsx`
**Change Type:** Abort error handling

**Changes:**
- Added import: `import { isAbortError } from "@/lib/api/error-handling"`
- Added abort error checks in record loading (lines ~76, ~82)

**Code Pattern:**
```typescript
if (error) {
  if (!isAbortError(error)) {
    console.error("Error loading record:", error)
  }
}
```

**Impact:** Reduces console errors during navigation.

#### `baserow-app/components/grid/RecordModal.tsx`
**Change Type:** Abort controllers + required field validation + error handling

**Major Changes:**

1. **AbortController Implementation (lines ~45, ~87-120):**
   - Added `abortControllerRef` to manage request cancellation
   - Cancels in-flight requests when modal closes or record changes
   - Passes abort signal to fetch requests

2. **Enhanced loadRecord() (lines ~125-180):**
   - Accepts `AbortSignal` parameter
   - Checks for abort before state updates
   - Ignores abort errors silently

3. **Enhanced loadFields() (lines ~182-240):**
   - Accepts `AbortSignal` parameter
   - Uses signal in fetch request
   - Multiple abort checks before state updates
   - Handles DOMException and AbortError

**Code Snippet:**
```typescript
const abortControllerRef = useRef<AbortController | null>(null)

useEffect(() => {
  if (!isOpen || !recordId || !tableName || !tableId) {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    return
  }
  
  const abortController = new AbortController()
  abortControllerRef.current = abortController
  
  loadRecord(abortController.signal).catch((error) => {
    if (!isAbortError(error)) {
      console.error("Error in loadRecord:", error)
    }
  })
  
  return () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }
}, [isOpen, recordId, tableName, tableId])
```

**Impact:** Prevents race conditions and console errors when modal closes quickly.

---

### Interface Components

#### `baserow-app/components/interface/InterfacePageClient.tsx`
**Change Type:** Abort controllers for block loading

**Changes:**
1. **AbortController for loadBlocks() (lines ~78, ~688-850):**
   - Added `abortControllerRef` to track in-flight requests
   - Aborts previous request when page changes
   - Passes abort signal to fetch request
   - Ignores abort errors in catch block
   - Only resets loading state if request wasn't aborted

2. **Cleanup on unmount (lines ~850-858):**
   - Aborts any in-flight requests on component unmount

**Code Snippet:**
```typescript
const abortControllerRef = useRef<AbortController | null>(null)

// In loadBlocks():
if (abortControllerRef.current) {
  abortControllerRef.current.abort()
}

const abortController = new AbortController()
abortControllerRef.current = abortController

const res = await fetch(`/api/pages/${page.id}/blocks`, {
  signal: abortController.signal,
})

if (abortController.signal.aborted) {
  return
}

// In catch:
if (isAbortError(error)) {
  console.log('[loadBlocks] Request aborted (expected)')
  return
}
```

**Impact:** Prevents race conditions when navigating between pages quickly.

#### `baserow-app/components/interface/RecordPanelEditor.tsx`
**Change Type:** Error handling improvements

**Changes:** Enhanced error handling for record updates (specific changes not detailed in diff summary).

#### `baserow-app/components/interface/RecordReviewLeftColumn.tsx`
**Change Type:** Error handling improvements

**Changes:** Enhanced error handling (45 lines changed, specific details not in diff summary).

#### `baserow-app/components/interface/RecordReviewView.tsx`
**Change Type:** Error handling improvements

**Changes:** Enhanced error handling (147 lines changed, specific details not in diff summary).

#### `baserow-app/components/interface/blocks/ChartBlock.tsx`
**Change Type:** Session management + 401 error handling

**Major Changes:**

1. **Session Refresh in loadTableFields() (lines ~131-142):**
   - Checks for active session before requests
   - Refreshes session if missing
   - Redirects to login if refresh fails

2. **401 Error Handling in loadTableFields() (lines ~150-175):**
   - Detects PGRST301 (401 Unauthorized) errors
   - Refreshes session and retries request
   - Redirects to login if refresh fails

3. **Session Refresh in loadData() (lines ~205-212):**
   - Same session check/refresh pattern

4. **401 Error Handling in loadData() (lines ~214-245):**
   - Detects authentication errors
   - Refreshes session and retries
   - Redirects to login if refresh fails

**Code Snippet:**
```typescript
// Ensure we have a valid session before making requests
const { data: { session }, error: sessionError } = await supabase.auth.getSession()
if (sessionError || !session) {
  console.warn("No active session, attempting to refresh...")
  const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError || !refreshedSession) {
    console.error("Session refresh failed, redirecting to login:", refreshError)
    router.push('/login?next=' + encodeURIComponent(window.location.pathname))
    return
  }
}

// Handle 401 errors
if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('expired')) {
  // Try refreshing session
  const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError || !refreshedSession) {
    router.push('/login?next=' + encodeURIComponent(window.location.pathname))
    return
  }
  // Retry the request after refresh
  const { data: retryData, error: retryError } = await supabase...
}
```

**Impact:** Fixes 401 authentication errors in ChartBlock by automatically refreshing sessions.

#### `baserow-app/components/interface/blocks/FieldBlock.tsx`
**Change Type:** Error handling

**Changes:** Minor error handling improvements (3 lines changed).

#### `baserow-app/components/interface/blocks/GridBlock.tsx`
**Change Type:** Error handling improvements

**Changes:** Enhanced error handling (60 lines changed, specific details not in diff summary).

---

### Layout Components

#### `baserow-app/components/layout/GroupedInterfaces.tsx`
**Change Type:** Minor error handling

**Changes:** Minor error handling improvements (3 lines changed).

#### `baserow-app/components/layout/NavigationDiagnostics.tsx`
**Change Type:** Session management improvements

**Changes:** Enhanced session management (227 lines changed, simplified from previous version).

#### `baserow-app/components/layout/PerformanceMonitor.tsx`
**Change Type:** Error handling improvements

**Changes:** Enhanced error handling (59 lines changed).

#### `baserow-app/components/layout/design/PermissionsTab.tsx`
**Change Type:** Error handling

**Changes:** Minor error handling improvements (3 lines changed).

---

### Other Components

#### `baserow-app/components/records/RecordFieldPanel.tsx`
**Change Type:** Error handling

**Changes:** Enhanced error handling (14 lines changed).

#### `baserow-app/components/settings/WorkspaceTab.tsx`
**Change Type:** Abort error handling

**Changes:**
- Added abort error handling (43 lines changed)
- Similar pattern to other components: `if (isAbortError(error)) return`

**Impact:** Reduces console errors during navigation.

#### `baserow-app/components/views/MultiTimelineView.tsx`
**Change Type:** Error handling

**Changes:** Enhanced error handling (27 lines changed).

---

## Change Categories for Selective Re-application

### Category 1: CORS Configuration & Fetch Wrapper ⚠️ CRITICAL
**Files:**
- `baserow-app/lib/supabase/fetch-wrapper.ts` (NEW)
- `baserow-app/lib/supabase/client.ts`
- `lib/supabase.ts`
- `docs/guides/SUPABASE_CORS_CONFIGURATION.md` (NEW)
- `supabase/migrations/fix_cors_for_production_domain.sql` (NEW)

**Dependencies:** None (can be applied independently)

**Impact:** 
- **Critical for production CORS issues**
- Required if you're experiencing CORS errors in production
- Adds retry logic for network errors
- Provides helpful CORS error messages

**Re-application Notes:**
- Must apply all files together (fetch-wrapper is imported by client files)
- SQL migration should be run in Supabase dashboard
- Documentation is optional but helpful

---

### Category 2: Abort Error Handling ✅ SAFE
**Files:**
- `baserow-app/components/grid/AirtableGridView.tsx`
- `baserow-app/components/grid/AirtableViewPage.tsx`
- `baserow-app/components/grid/RecordDrawer.tsx`
- `baserow-app/components/grid/RecordModal.tsx` (also includes AbortController)
- `baserow-app/components/interface/InterfacePageClient.tsx` (also includes AbortController)
- `baserow-app/components/settings/WorkspaceTab.tsx`

**Dependencies:** Requires `baserow-app/lib/api/error-handling.ts` with `isAbortError()` function

**Impact:**
- Reduces console errors from expected navigation-related aborts
- Prevents race conditions in RecordModal and InterfacePageClient
- **Not critical for functionality** - mainly improves developer experience

**Re-application Notes:**
- Can be applied incrementally (file by file)
- RecordModal and InterfacePageClient changes are more complex (AbortController)
- Other files are simple (just add `isAbortError()` check)

---

### Category 3: Required Field Validation ✅ SAFE
**Files:**
- `baserow-app/components/grid/GridView.tsx`
- `baserow-app/components/grid/RecordModal.tsx` (if it has validation - check diff)

**Dependencies:** None

**Impact:**
- Improves UX by catching validation errors early
- Shows user-friendly warnings before database errors
- **Not critical** - database constraints will still enforce

**Re-application Notes:**
- Can be applied independently
- GridView changes are self-contained
- Improves user experience but not required

---

### Category 4: Session Management & 401 Handling ⚠️ IMPORTANT
**Files:**
- `baserow-app/components/interface/blocks/ChartBlock.tsx`
- `baserow-app/components/layout/NavigationDiagnostics.tsx`

**Dependencies:** None

**Impact:**
- **Fixes 401 authentication errors in ChartBlock**
- Automatically refreshes expired sessions
- Redirects to login when session can't be refreshed
- **Important if you're experiencing auth issues**

**Re-application Notes:**
- Can be applied independently
- ChartBlock changes are specific to that component
- NavigationDiagnostics changes are separate
- Should be applied if you see 401 errors in production

---

### Category 5: Grouping Logic Fix ✅ SAFE
**Files:**
- `baserow-app/components/grid/GridViewWrapper.tsx`

**Dependencies:** None

**Impact:**
- **Fixes grouping behavior** when removing grouping from blocks
- Prevents grouping from being restored when removed from block config
- Ensures block config takes precedence over view settings

**Re-application Notes:**
- Single file change
- Can be applied independently
- Self-contained fix
- Should be applied if grouping behavior is incorrect

---

### Category 6: General Error Handling Improvements ✅ SAFE
**Files:**
- `baserow-app/components/interface/RecordPanelEditor.tsx`
- `baserow-app/components/interface/RecordReviewLeftColumn.tsx`
- `baserow-app/components/interface/RecordReviewView.tsx`
- `baserow-app/components/interface/blocks/FieldBlock.tsx`
- `baserow-app/components/interface/blocks/GridBlock.tsx`
- `baserow-app/components/layout/GroupedInterfaces.tsx`
- `baserow-app/components/layout/PerformanceMonitor.tsx`
- `baserow-app/components/layout/design/PermissionsTab.tsx`
- `baserow-app/components/records/RecordFieldPanel.tsx`
- `baserow-app/components/views/MultiTimelineView.tsx`

**Dependencies:** None

**Impact:**
- Better error messages
- Improved error logging
- More graceful error handling
- **Not critical** - mainly improves debugging

**Re-application Notes:**
- Can be applied incrementally
- Low risk changes
- Improves developer experience

---

## Re-application Priority

### High Priority (Apply First)
1. **Category 1: CORS Configuration** - If experiencing CORS errors
2. **Category 4: Session Management** - If experiencing 401 errors
3. **Category 5: Grouping Logic Fix** - If grouping behavior is incorrect

### Medium Priority
4. **Category 3: Required Field Validation** - Improves UX
5. **Category 2: Abort Error Handling** - Reduces console noise

### Low Priority
6. **Category 6: General Error Handling** - Nice to have

---

## Dependencies Between Categories

- **Category 1** is independent (but all files must be applied together)
- **Category 2** requires `isAbortError()` function (already exists in codebase)
- **Category 3** is independent
- **Category 4** is independent
- **Category 5** is independent
- **Category 6** is independent

**Note:** All categories can be applied independently, but Category 1 files must be applied together as a unit.

---

## Testing Checklist

After re-applying each category, test:

### Category 1 (CORS):
- [ ] No CORS errors in browser console
- [ ] Auth requests work
- [ ] Data API requests work
- [ ] Network retries work on connection errors

### Category 2 (Abort Errors):
- [ ] No abort error spam in console during navigation
- [ ] RecordModal doesn't show stale data when closing quickly
- [ ] InterfacePageClient doesn't show wrong blocks when navigating quickly

### Category 3 (Required Fields):
- [ ] Warning appears when creating record with missing required fields
- [ ] Can proceed anyway (if database allows)
- [ ] Database errors show user-friendly messages

### Category 4 (Session Management):
- [ ] ChartBlock loads without 401 errors
- [ ] Session refreshes automatically on expiry
- [ ] Redirects to login when session can't be refreshed

### Category 5 (Grouping):
- [ ] Removing grouping from block config clears grouping
- [ ] Grouping doesn't restore from view settings when removed from block
- [ ] Block config grouping takes precedence

### Category 6 (General Errors):
- [ ] Better error messages in console
- [ ] Errors are handled gracefully

---

## Git Commands for Re-application

To re-apply specific categories, you can cherry-pick commits or manually apply changes:

```bash
# View specific commit changes
git show ccd1724360  # Category 6 (general error handling)
git show 254199ac9e  # Category 2 (abort errors)
git show 8feb7dcdc2  # Category 2 (abort errors)
git show 3a338b48d6  # Category 3 (required fields)
git show b7bc9f8e3a  # Category 4 (session management)
git show e1aac04180  # Category 4 (session management)
git show 9d076f1d9d  # Category 1 (CORS/fetch-wrapper)
```

**Note:** Commits don't map 1:1 with categories. Some commits contain multiple categories. Use this document to identify which files to re-apply.

---

## Questions?

If you need to re-apply specific changes, refer to:
1. This document for change details
2. Git diff: `git diff 749a7ba..HEAD <file-path>`
3. Individual commits: `git show <commit-hash>`
