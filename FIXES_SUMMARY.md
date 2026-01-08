# Interface Wiring Fixes - Summary

## What Changed

### Critical Bug Fixes

1. **BlockRenderer pageTableId Wiring** ✅
   - **File**: `baserow-app/components/interface/BlockRenderer.tsx`
   - **Change**: Pass real `pageTableId` prop instead of `null` to GridBlock, FormBlock, RecordBlock, ChartBlock, KPIBlock
   - **Why**: Blocks need page table fallback for calendar/list/table views

2. **Layout Persistence** ✅
   - **Files**: 
     - `baserow-app/app/api/pages/[pageId]/blocks/route.ts` - Preserve layout columns when updating config
     - `baserow-app/components/interface/Canvas.tsx` - Fix hydration to preserve DB values
     - `baserow-app/components/interface/InterfacePageClient.tsx` - Preserve layout values on load
   - **Change**: API now preserves position_x/position_y/width/height when updating config; Canvas only defaults when ALL values are null
   - **Why**: Prevents layout resets on reload

3. **TextBlock Persistence** ✅
   - **File**: `baserow-app/components/interface/blocks/TextBlock.tsx`
   - **Change**: Fixed config loading detection; added editing guards to prevent rehydration during typing
   - **Why**: Content was being wiped by rehydration during editing

4. **Calendar View** ✅
   - **Files**:
     - `baserow-app/components/views/CalendarView.tsx` - Added debug logging, fixed event click
     - `baserow-app/components/interface/blocks/GridBlock.tsx` - Added onRecordClick prop
     - `baserow-app/components/interface/BlockRenderer.tsx` - Pass onRecordClick
     - `baserow-app/components/interface/Canvas.tsx` - Pass onRecordClick
     - `baserow-app/components/interface/InterfaceBuilder.tsx` - Pass onRecordClick
     - `baserow-app/components/interface/RecordReviewView.tsx` - Wire calendar clicks
   - **Change**: Added debug logging (localStorage.DEBUG_CALENDAR=1), fixed event click handler, wired RecordReview integration
   - **Why**: Calendar wasn't logging, events were wrong, clicks didn't work

5. **List Page** ✅
   - **Files**: Verified existing wiring (no changes needed)
   - **Change**: BlockRenderer fix ensures blocks get pageTableId
   - **Why**: List pages use PageViewBlockWrapper which already passes pageTableId correctly

6. **Pre-Deploy Checks** ✅
   - **File**: `baserow-app/__tests__/interface-lifecycle.test.ts`
   - **Change**: Added unit tests for table ID resolution, layout mapping, TextBlock persistence
   - **Why**: Prevent deployments from breaking core flows

### Additional Improvements

- Added regression warnings in dev mode for null layout values
- Improved logging throughout for debugging
- Added guards to prevent rehydration during user editing

## Files Modified (10 files)

1. `baserow-app/components/interface/BlockRenderer.tsx`
2. `baserow-app/components/interface/Canvas.tsx`
3. `baserow-app/components/interface/InterfacePageClient.tsx`
4. `baserow-app/app/api/pages/[pageId]/blocks/route.ts`
5. `baserow-app/components/interface/blocks/TextBlock.tsx`
6. `baserow-app/components/views/CalendarView.tsx`
7. `baserow-app/components/interface/blocks/GridBlock.tsx`
8. `baserow-app/components/interface/InterfaceBuilder.tsx`
9. `baserow-app/components/interface/RecordReviewView.tsx`
10. `baserow-app/__tests__/interface-lifecycle.test.ts` (new)

## Manual Verification Checklist

After deployment, test these scenarios:

### ✅ TextBlock Persistence
1. Create/edit a TextBlock
2. Type content
3. Wait 1 second (debounce)
4. Refresh page
5. **Expected**: Content persists

### ✅ Layout Persistence  
1. Create dashboard/content page
2. Add blocks
3. Drag/resize blocks
4. Wait for "All changes saved"
5. Refresh page
6. **Expected**: Blocks maintain positions/sizes

### ✅ Calendar View
1. Enable debug: `localStorage.setItem('DEBUG_CALENDAR', '1')`
2. Create calendar page with table + date field
3. Check console for `[Calendar]` logs
4. Click an event
5. **Expected**: Opens record modal OR updates RecordReview selected record

### ✅ List Page
1. Create list page with saved_view_id
2. **Expected**: Renders table rows (not blank)

### ✅ Table ID Fallback
1. Create grid/calendar block without explicit table_id
2. **Expected**: Uses page.base_table, shows data

## Debug Commands

```javascript
// Enable calendar debug logging
localStorage.setItem('DEBUG_CALENDAR', '1')

// Check console for:
// [Calendar] Loading rows from table
// [Calendar] Loaded X rows
// [Calendar] Generated X events
// [Calendar] Event clicked
```

## Test Commands

```bash
# Run unit tests
npm test interface-lifecycle

# Or with vitest
npx vitest interface-lifecycle
```

## Notes

- All changes are minimal and focused on fixing bugs
- No new features added
- No architectural changes
- Backward compatible
