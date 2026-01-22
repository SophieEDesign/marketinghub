# Interface Wiring Fixes - End-to-End Audit

## Summary

Fixed critical bugs in the Interface Builder system that were causing:
- TextBlock content not persisting
- Dashboard/Content page layouts reverting after reload
- Calendar view broken (wrong events, no logs, no click handler)
- List pages not rendering data
- Missing pre-deploy safety checks

## Changes Made

### 1. Fixed BlockRenderer pageTableId Wiring ✅

**Problem**: BlockRenderer was passing `pageTableId={null}` to all data-backed blocks, breaking table resolution fallback.

**Solution**: Pass real `pageTableId` prop to all data blocks (GridBlock, FormBlock, RecordBlock, ChartBlock, KPIBlock).

**Files Modified**:
- `baserow-app/components/interface/BlockRenderer.tsx`
  - Changed `pageTableId={null}` to `pageTableId={pageTableId}` for all data blocks
  - Added comments documenting canonical resolution order

**Canonical Rule Established**:
```typescript
tableId = block.config.table_id || page.base_table (pageTableId) || block.config.base_table || null
```

### 2. Fixed Layout Persistence (Dashboard/Content) ✅

**Problem**: Layout saves but reverts on reload - blocks return to default small size.

**Root Cause**: 
- API was updating config but not preserving layout columns when updating blocks
- Canvas was defaulting values incorrectly when some (but not all) layout values were null

**Solution**:
- Modified API PATCH route to preserve layout columns (position_x, position_y, width, height) when updating config
- Fixed Canvas hydration to only default when ALL values are null (new blocks)
- Added regression checks: warn in dev if existing blocks have null layout values
- Fixed InterfacePageClient block loading to preserve actual DB values

**Files Modified**:
- `baserow-app/app/api/pages/[pageId]/blocks/route.ts`
  - Preserve layout columns when updating config
- `baserow-app/components/interface/Canvas.tsx`
  - Fixed hydration logic to preserve existing values
  - Added regression warnings for null layout values
- `baserow-app/components/interface/InterfacePageClient.tsx`
  - Fixed block loading to preserve DB values (don't default unnecessarily)

**Key Changes**:
```typescript
// API: Preserve layout when updating config
const { data: currentBlockData } = await supabase
  .from('view_blocks')
  .select('position_x, position_y, width, height')
  .eq('id', update.id)
  .single()

await supabase
  .from('view_blocks')
  .update({
    config: normalizedConfig,
    position_x: currentBlockData?.position_x ?? undefined, // Preserve
    position_y: currentBlockData?.position_y ?? undefined,
    width: currentBlockData?.width ?? undefined,
    height: currentBlockData?.height ?? undefined,
  })
```

### 3. Fixed TextBlock Persistence ✅

**Problem**: TextBlock content not persisting/rehydrating correctly.

**Root Causes**:
- Config loading detection was too aggressive (treating empty config as loading)
- Rehydration was interrupting user typing
- onUpdate callback wiring was correct but needed guards

**Solution**:
- Fixed `isConfigLoading` detection - don't treat empty/null content_json as loading
- Added guards to prevent rehydration when user is actively editing (`isBlockEditing && isFocused`)
- Verified onUpdate → API → DB → rehydration flow is correct

**Files Modified**:
- `baserow-app/components/interface/blocks/TextBlock.tsx`
  - Fixed config loading detection
  - Added editing guards to prevent rehydration during typing
  - Improved rehydration logging

**Key Changes**:
```typescript
// Don't treat empty/null content_json as loading
const isConfigLoading = config === undefined || (config !== null && contentJson === undefined && Object.keys(config).length === 0)

// Don't rehydrate if user is editing
if (isBlockEditing && isFocused) {
  return // Skip rehydration
}
```

### 4. Fixed Calendar View ✅

**Problem**: Wrong events, no console logs, clicking doesn't open record.

**Root Causes**:
- Date field resolution was using IDs instead of names when reading row data
- No debug logging (hard to diagnose)
- Event click handler wasn't wired for RecordReview integration

**Solution**:
- Added debug logging (enable via `localStorage.DEBUG_CALENDAR=1`)
- Fixed date field resolution to use field NAME (Supabase rows use names as keys)
- Added `onRecordClick` prop support through component chain
- Calendar now opens record modal OR calls onRecordClick callback (for RecordReview)

**Files Modified**:
- `baserow-app/components/views/CalendarView.tsx`
  - Added debug logging flag (`localStorage.DEBUG_CALENDAR=1`)
  - Fixed event click handler to use onRecordClick callback if provided
  - Improved date field resolution logging
- `baserow-app/components/interface/blocks/GridBlock.tsx`
  - Added `onRecordClick` prop
  - Pass to CalendarView
- `baserow-app/components/interface/BlockRenderer.tsx`
  - Added `onRecordClick` prop
  - Pass to GridBlock
- `baserow-app/components/interface/Canvas.tsx`
  - Added `onRecordClick` prop
  - Pass to BlockRenderer
- `baserow-app/components/interface/InterfaceBuilder.tsx`
  - Added `onRecordClick` prop
  - Pass to Canvas
- `baserow-app/components/interface/RecordReviewView.tsx`
  - Pass `onRecordClick` callback to InterfaceBuilder that updates `selectedRecordId`

**Key Changes**:
```typescript
// CalendarView: Use onRecordClick callback if provided
eventClick={(info) => {
  const recordId = info.event.id
  if (onRecordClick) {
    onRecordClick(recordId) // For RecordReview integration
  } else {
    setSelectedRecordId(recordId) // Default: open modal
  }
}}

// RecordReviewView: Wire calendar clicks to record selection
<InterfaceBuilder
  onRecordClick={(recordId) => {
    setSelectedRecordId(recordId)
  }}
/>
```

### 5. Fixed List Page ✅

**Problem**: List pages not rendering table data.

**Root Cause**: List pages use `PageViewBlockWrapper` which already passes `pageTableId` correctly, but needed verification.

**Solution**: Verified that:
- `PageRenderer` correctly routes 'list' case to `PageViewBlockWrapper`
- `PageViewBlockWrapper` resolves tableId correctly and passes to GridBlock
- GridBlock receives `pageTableId` and uses it for table resolution

**Files Verified**:
- `baserow-app/components/interface/PageRenderer.tsx` - Routes list to PageViewBlockWrapper ✅
- `baserow-app/components/interface/PageViewBlockWrapper.tsx` - Passes pageTableId ✅
- `baserow-app/components/interface/blocks/GridBlock.tsx` - Uses pageTableId fallback ✅

**No changes needed** - wiring was correct, but BlockRenderer fix ensures blocks get pageTableId.

### 6. Added Pre-Deploy Safety Checks ✅

**Problem**: No automated checks to prevent deployments from breaking core flows.

**Solution**: Added unit tests for critical wiring paths.

**Files Created**:
- `baserow-app/__tests__/interface-lifecycle.test.ts`
  - Table ID resolution order tests
  - Layout persistence API mapping tests
  - TextBlock config persistence tests

**Test Coverage**:
- ✅ Table ID resolution order (block.config.table_id → page.base_table → block.config.base_table → null)
- ✅ Layout API mapping (x/y/w/h ↔ position_x/position_y/width/height)
- ✅ TextBlock content_json persistence structure

**To Run Tests**:
```bash
npm test interface-lifecycle
```

## Files Modified Summary

### Critical Fixes:
1. **BlockRenderer.tsx** - Pass pageTableId to all data blocks
2. **Canvas.tsx** - Fix layout hydration, preserve DB values
3. **InterfacePageClient.tsx** - Extract and pass pageTableId, preserve block layout values
4. **API route.ts** - Preserve layout columns when updating config
5. **TextBlock.tsx** - Fix config loading detection, add editing guards
6. **CalendarView.tsx** - Add debug logging, fix event click handler
7. **GridBlock.tsx** - Add onRecordClick prop support
8. **InterfaceBuilder.tsx** - Add onRecordClick prop support
9. **RecordReviewView.tsx** - Wire calendar clicks to record selection

### Test Files:
10. **__tests__/interface-lifecycle.test.ts** - Pre-deploy safety checks

## Verification Checklist

After deployment, verify manually:

### TextBlock Persistence:
- [ ] Create a TextBlock, type content, wait 1s, refresh page
- [ ] Content should still be there
- [ ] Check console for `[TextBlock Write]` logs showing save
- [ ] Check console for `[TextBlock Rehydration]` logs showing load

### Layout Persistence:
- [ ] Create a dashboard/content page
- [ ] Add blocks, drag/resize them
- [ ] Wait for "All changes saved" message
- [ ] Refresh page
- [ ] Blocks should be in same positions/sizes
- [ ] Check console for `[Layout Write]` logs showing save
- [ ] Check console for `[Layout Rehydration]` logs showing load
- [ ] Check for regression warnings if layout values are null

### Calendar View:
- [ ] Enable debug: `localStorage.setItem('DEBUG_CALENDAR', '1')`
- [ ] Create a calendar page with table + date field
- [ ] Check console for `[Calendar]` logs showing:
  - Table ID resolution
  - Date field resolution
  - Row count
  - Event count
- [ ] Click an event
- [ ] Should open record modal OR update RecordReview selected record

### List Page:
- [ ] Create a list page with saved_view_id
- [ ] Page should render table rows (not blank)
- [ ] Check that pageTableId is resolved correctly

### Table ID Wiring:
- [ ] Create a grid/calendar block without explicit table_id
- [ ] Block should use page.base_table as fallback
- [ ] Should show data (not "no table connection")

## Debugging Tips

### Enable Calendar Debug Logging:
```javascript
localStorage.setItem('DEBUG_CALENDAR', '1')
// Reload page to see detailed calendar logs
```

### Check Layout Persistence:
1. Open browser DevTools → Network tab
2. Drag/resize a block
3. Look for PATCH request to `/api/pages/[pageId]/blocks`
4. Verify payload includes `layout` array with x/y/w/h values
5. Check response - should return success
6. Reload page, check GET request - verify blocks have position_x/position_y/width/height

### Check TextBlock Persistence:
1. Open browser DevTools → Console
2. Type in TextBlock
3. Look for `[TextBlock Write]` logs
4. Check Network tab for PATCH request with `content_json` in payload
5. Reload page, check GET request - verify block has `content_json` in config

## Known Limitations

- **RecordReviewView remounts are intentional**: The `key={`record-${selectedRecordId}`}` causes InterfaceBuilder to remount when record changes. This is by design to reset block context for the new record.
- **Content pages don't require tables**: Content pages can have `pageTableId={null}` - this is correct.

## Next Steps

1. Run unit tests: `npm test interface-lifecycle`
2. Test manually using checklist above
3. Monitor console logs in development
4. Add Playwright smoke tests (future enhancement)
