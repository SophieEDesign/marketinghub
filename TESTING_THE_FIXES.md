# Testing Guide - Bug Fixes Verification

## What Changed?

These fixes address **data persistence**, not visual appearance. They ensure:
- ✅ TextBlock content persists after save and refresh
- ✅ Layout positions persist after drag/resize and refresh
- ✅ List/grid views load data correctly
- ✅ Calendar events are clickable and open records

## How to Test

### 1. Clear Browser Cache
- **Chrome/Edge**: Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Or: Open DevTools → Right-click refresh button → "Empty Cache and Hard Reload"

### 2. Enable Debug Logging
Open browser console (F12) and run:
```javascript
localStorage.setItem('DEBUG_ALL', '1')
```
Then refresh the page. You'll see detailed logs in the console.

### 3. Test TextBlock Persistence

**Steps:**
1. Open a page with a TextBlock (or create one)
2. Click "Edit interface" button
3. Click on the TextBlock to edit
4. Type some text (e.g., "Test content")
5. Wait 1 second → You should see "✓ Saved" indicator
6. **Refresh the page** (F5 or Ctrl+R)
7. ✅ **Expected**: Your text should still be there

**If it doesn't persist:**
- Check browser console for errors
- Check Network tab → Look for PATCH request to `/api/pages/[pageId]/blocks`
- Verify the request includes `content_json` in the body

### 4. Test Layout Persistence

**Steps:**
1. Open a dashboard/content page
2. Click "Edit interface" button
3. Drag a block to a new position
4. Resize a block
5. Wait 1 second → Layout should auto-save
6. **Refresh the page** (F5 or Ctrl+R)
7. ✅ **Expected**: Blocks should be in the same positions/sizes

**If layout resets:**
- Check browser console for errors
- Check Network tab → Look for PATCH request with `layout` array
- Verify blocks have `x`, `y`, `w`, `h` values in the response

### 5. Test List View Data Loading

**Steps:**
1. Open a list view page
2. ✅ **Expected**: Rows should appear if table is configured
3. If no rows → Check if page has `saved_view_id` or `base_table` configured
4. Open browser console → Look for `[DEBUG LIST]` logs
5. Check Network tab → Look for GET request to `/api/pages/[pageId]`

**If no data appears:**
- Check console for `[DEBUG LIST]` logs showing tableId resolution
- Verify page has `saved_view_id` or `base_table` in settings
- Check if table has data

### 6. Test Calendar Event Clicks

**Steps:**
1. Open a calendar page
2. Click on an event
3. ✅ **Expected**: Should open record modal or navigate to record
4. Open browser console → Look for `[Calendar] Event clicked` logs

**If clicks don't work:**
- Check console for errors
- Verify calendar has `date_field` configured in settings
- Check if events are rendering (should see events in calendar grid)

## Debug Logs to Look For

With `DEBUG_ALL` enabled, you should see:

### TextBlock:
```
[DEBUG TEXT] Block [id]: RENDER
[DEBUG TEXT] Block [id]: CONFIG CHANGED
[TextBlock Write] Block [id]: BEFORE SAVE
[TextBlock Write] Block [id]: VERIFICATION
```

### Layout:
```
[DEBUG LAYOUT] Block BEFORE DB UPDATE
[DEBUG LAYOUT] Block AFTER DB UPDATE
```

### List View:
```
[DEBUG LIST] GridBlock tableId resolution
[DEBUG LIST] GridView rows loaded
```

### Calendar:
```
[Calendar] Event clicked
[Calendar] Date field resolution
```

## Common Issues

### Issue: Changes don't persist after refresh
**Solution:**
- Check browser console for errors
- Verify API requests are succeeding (check Network tab)
- Check if `content_json` or `layout` is in the request/response

### Issue: No debug logs appearing
**Solution:**
- Verify `localStorage.setItem('DEBUG_ALL', '1')` was run
- Refresh page after setting localStorage
- Check if you're in development mode (logs only appear in dev)

### Issue: Layout resets to default positions
**Solution:**
- Check if blocks have `position_x`, `position_y`, `width`, `height` in database
- Verify API response includes `x`, `y`, `w`, `h` values
- Check console for layout hydration logs

## Still Not Working?

1. **Check browser console** for errors
2. **Check Network tab** for failed API requests
3. **Verify dev server is running** and up-to-date
4. **Try incognito mode** to rule out cache issues
5. **Check database** directly to see if data is being saved
