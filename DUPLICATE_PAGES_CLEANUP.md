# Duplicate Record Review Pages - Cleanup Guide

## How to Identify Duplicate Pages

### Option 1: Via Settings UI (Recommended)
1. Go to **Settings > Pages** tab
2. Look for pages with:
   - Same or similar names (e.g., "Record Review", "Record Review (Copy)")
   - Same page type: **Record Review**
   - Same table connection (check the page settings)
3. Compare the **Updated** dates - keep the most recent one

### Option 2: Via Browser Console
Open your browser's developer console (F12) and run:

```javascript
// Fetch all pages and filter record_review pages
fetch('/api/interface-pages')
  .then(r => r.json())
  .then(pages => {
    const recordReviewPages = pages.filter(p => p.page_type === 'record_review')
    console.table(recordReviewPages.map(p => ({
      id: p.id,
      name: p.name,
      base_table: p.base_table,
      created: new Date(p.created_at).toLocaleDateString(),
      updated: new Date(p.updated_at || p.created_at).toLocaleDateString()
    })))
    
    // Group by base_table to find duplicates
    const byTable = {}
    recordReviewPages.forEach(p => {
      const key = p.base_table || 'no-table'
      if (!byTable[key]) byTable[key] = []
      byTable[key].push(p)
    })
    
    console.log('\n📊 Pages grouped by table:')
    Object.entries(byTable).forEach(([table, pages]) => {
      if (pages.length > 1) {
        console.log(`\n⚠️  DUPLICATES for table ${table}:`)
        pages.forEach(p => console.log(`  - ${p.name} (${p.id}) - Updated: ${new Date(p.updated_at || p.created_at).toLocaleDateString()}`))
      }
    })
  })
```

## Which Pages to Keep

**Keep the page that:**
- ✅ Works correctly (the new one you created)
- ✅ Has the most recent "Updated" date
- ✅ Has the correct table connection configured
- ✅ Has the blocks/content you want

**Delete the pages that:**
- ❌ Don't work (the old broken one)
- ❌ Have older "Updated" dates
- ❌ Are duplicates with the same table connection

## How to Delete Duplicate Pages

### Method 1: Via Settings UI
1. Go to **Settings > Pages**
2. Find the duplicate page
3. Click the **Delete** button (trash icon) on the right
4. Confirm deletion

### Method 2: Via API (if needed)
```bash
# Replace [pageId] with the actual page ID
curl -X DELETE http://localhost:3000/api/interface-pages/[pageId]
```

## Safety Checklist Before Deleting

- [ ] Verified the new page works correctly
- [ ] Checked that the new page has the correct table connection
- [ ] Confirmed the new page has all the blocks/content you need
- [ ] Noted the page ID of the page you want to keep
- [ ] Backed up important data (if needed)

## After Cleanup

1. Refresh the Settings > Pages tab
2. Verify only one record review page remains
3. Test the remaining page to ensure it works correctly
4. Update any bookmarks or links that might reference the deleted page

## Notes

- Deleting a page will also delete all blocks associated with it
- Pages are soft-deleted (can be recovered from database if needed)
- If a page is set as the default interface, it will be cleared before deletion
- Related views (`saved_view_id`) are NOT deleted - only the page record is removed

