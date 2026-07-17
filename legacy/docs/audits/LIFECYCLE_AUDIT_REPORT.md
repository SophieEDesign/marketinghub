# Interface Render Lifecycle Audit Report

## Goal
Stop components from remounting after initial render, prevent late redirects or data rehydration from overwriting user state, and ensure pages load once and blocks persist.

## Changes Made

### 1. Mount/Unmount Logging Added ✅

Added lifecycle logging to track component mount/unmount cycles:

- **InterfaceBuilder.tsx**: Logs mount/unmount with pageId and block count
- **Canvas.tsx**: Logs mount/unmount with pageId and recordId
- **TextBlock.tsx**: Logs mount/unmount with blockId
- **CalendarView.tsx**: Logs mount/unmount with tableId and viewId

**Files Modified:**
- `baserow-app/components/interface/InterfaceBuilder.tsx`
- `baserow-app/components/interface/Canvas.tsx`
- `baserow-app/components/interface/blocks/TextBlock.tsx`
- `baserow-app/components/views/CalendarView.tsx`

### 2. Keys on Page-Level Components ✅

**Identified Keys:**
- `RecordReviewView.tsx:517`: `key={`record-${selectedRecordId}`}` - **INTENTIONAL** - Needs to remount when record changes (by design)
- `CalendarView.tsx:1113`: `key={`calendar-${resolvedTableId}-${resolvedDateFieldId}-${calendarEvents.length}`}` - **FIXED** - Removed `calendarEvents.length` to prevent remounts on data changes

**Files Modified:**
- `baserow-app/components/views/CalendarView.tsx` - Changed key to stable `calendar-${resolvedTableId}-${resolvedDateFieldId}`

### 3. Router.push/replace Calls After Initial Render ✅

**Audit Results:**
- ✅ No `router.push` or `router.replace` calls found in `useEffect` hooks after initial render
- ✅ All router navigation calls are in event handlers (onClick) - safe and intentional
- ✅ `PageSetupState.tsx` router calls are only in button click handlers - no late redirects

**No changes needed** - All router calls are intentional and user-initiated.

### 4. Page Data Loaded Once and Stored in Ref ✅

**Changes Made:**
- Added `initialPageRef`, `initialDataRef`, and `pageLoadedRef` to track initial load state
- Modified `loadPage()` to only load if not already loaded (`pageLoadedRef.current`)
- Prevented overwriting initial page data after component mount

**Files Modified:**
- `baserow-app/components/interface/InterfacePageClient.tsx`

**Key Changes:**
```typescript
// Store initial data in refs
const initialPageRef = useRef<InterfacePage | null>(initialPage || null)
const initialDataRef = useRef<any[]>(initialData)
const pageLoadedRef = useRef<boolean>(!!initialPage)

// Only load if not already loaded
if (pageLoadedRef.current || loading) return
```

### 5. Block Data Updates Merged, Never Replaced ✅

**Changes Made:**
- Modified `handleBlockUpdate()` to merge config instead of replacing wholesale
- Modified `loadBlocks()` to merge with existing blocks instead of replacing
- Modified `initialBlocks` sync in `InterfaceBuilder` to merge after first load
- Added `blocksLoadedRef` to track if blocks have been loaded

**Files Modified:**
- `baserow-app/components/interface/InterfaceBuilder.tsx`
- `baserow-app/components/interface/InterfacePageClient.tsx`

**Key Changes:**
```typescript
// Merge config instead of replacing
setBlocks((prev) =>
  prev.map((b) => {
    if (b.id === blockId) {
      return {
        ...b,
        ...updatedBlock,
        config: { ...b.config, ...updatedBlock.config }
      }
    }
    return b
  })
)
```

### 6. Components Mount Only Once Per Page Visit ✅

**Verification:**
- **TextBlock**: Uses stable `block.id` as key for EditorContent - mounts once per block
- **CalendarView**: Fixed key to be stable (removed `calendarEvents.length`)
- **InterfaceBuilder**: Only loads blocks once per page visit (`blocksLoadedRef`)
- **Canvas**: Preserves layout state across remounts via `layoutHydratedRef`

**Files Modified:**
- `baserow-app/components/interface/InterfacePageClient.tsx` - Added `blocksLoadedRef` guard
- `baserow-app/components/views/CalendarView.tsx` - Fixed unstable key

## Files Causing Remounts (Before Fixes)

### Fixed Issues:
1. ✅ **CalendarView**: Unstable key including `calendarEvents.length` - FIXED
2. ✅ **InterfacePageClient**: Block reloads on edit mode entry - FIXED (only loads once)
3. ✅ **InterfaceBuilder**: Block updates replacing entire state - FIXED (now merges)

### Intentional Remounts (By Design):
1. **RecordReviewView**: `key={`record-${selectedRecordId}`}` - Intentional remount when record changes (needed for record context)

## Confirmation Checklist

- [x] Mount/unmount logging added to InterfaceBuilder, Canvas, TextBlock, CalendarView
- [x] Keys on page-level components identified and fixed (CalendarView)
- [x] Router.push/replace calls audited - none found after initial render
- [x] Page data loaded once and stored in ref (not replaced)
- [x] Block data updates merged (never replaced wholesale)
- [x] TextBlock, CalendarView mount only once per page visit

## Testing Recommendations

1. **Monitor Console Logs**: Check `[Lifecycle]` logs to verify components mount only once
2. **Test Block Updates**: Verify TextBlock content persists after config updates
3. **Test Page Navigation**: Verify blocks persist when navigating between pages
4. **Test Edit Mode**: Verify entering/exiting edit mode doesn't remount components
5. **Test Record Review**: Verify record changes remount InterfaceBuilder (intentional)

## Notes

- **RecordReviewView remounts are intentional**: The `key={`record-${selectedRecordId}`}` causes InterfaceBuilder to remount when record changes, which is necessary for record context. Canvas preserves layout via `layoutHydratedRef`.
- **All router calls are safe**: No late redirects found - all navigation is user-initiated via button clicks.
- **Data loading is now guarded**: Page and block data only load once per page visit, preventing overwrites.
