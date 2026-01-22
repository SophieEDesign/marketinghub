# Fixes Applied

## Issues Fixed

### 1. ✅ Missing `expandedTables` State
**Problem:** `expandedTables` was referenced but not declared in `AirtableSidebar.tsx`

**Fix:** Added `const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())`

### 2. ✅ Storage Bucket Error
**Problem:** Logo upload was failing because `branding` bucket doesn't exist

**Fix:** Updated `BrandingTab.tsx` to:
- Try `attachments` bucket first (most likely to exist)
- Fallback to `public` bucket
- Show helpful error message if neither exists

### 3. ⚠️ `table_fields` Table Missing
**Problem:** `table_fields` table returns 404, causing form block errors

**Solution:** Run the migration:
```sql
-- File: supabase/migrations/create_table_fields.sql
-- Run this in Supabase SQL Editor
```

The migration creates:
- `table_fields` table
- Indexes for performance
- RLS policies
- Helper functions

**Note:** The code already handles missing `table_fields` gracefully (returns empty array), but running the migration will enable full functionality.

### 4. ⚠️ Storage Buckets Need Creation
**Problem:** Storage buckets (`attachments`, `public`, `branding`) may not exist

**Solution:** Create buckets in Supabase Dashboard:
1. Go to **Supabase Dashboard → Storage**
2. Click **New Bucket**
3. Create bucket named **`attachments`**:
   - Public: ✅ Yes
   - File size limit: 50MB (or your preference)
   - Allowed MIME types: `image/*`, `application/pdf` (optional)
4. (Optional) Create **`public`** bucket for general files
5. (Optional) Create **`branding`** bucket specifically for branding assets

**Storage Policies:** After creating buckets, ensure these policies exist:
- **SELECT (Read):** Allow `anon` and `authenticated` roles
- **INSERT (Upload):** Allow `authenticated` role
- **UPDATE:** Allow `authenticated` role
- **DELETE:** Allow `authenticated` role

### 5. ℹ️ Favicon 404 (Harmless)
**Problem:** `favicon.ico` returns 404

**Status:** This is harmless - browsers request favicon automatically. To fix:
1. Create a favicon file (16x16 or 32x32 PNG/ICO)
2. Place it in `public/favicon.ico`
3. Or update `app/layout.tsx` to point to a different icon

## Next Steps

1. **Run `table_fields` migration** in Supabase SQL Editor
2. **Create storage buckets** in Supabase Dashboard
3. **Test logo upload** in Settings → Branding
4. **Verify tables are visible** in sidebar (Core Data section)

## Testing Checklist

- [ ] Tables appear in sidebar under "Core Data" section
- [ ] Can expand/collapse tables and views
- [ ] Logo upload works in Settings → Branding
- [ ] Form blocks load without errors
- [ ] CSV import works correctly
