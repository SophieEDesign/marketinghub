# Fixes Applied for Console Errors

## Issues Identified

1. **Duplicate field_key entries in table_fields** - Multiple warnings about duplicate fields
2. **pm-logo.svg 404** - Logo file missing
3. **needs_attention query 400 error** - URL parameter not being handled correctly
4. **view_settings 404 error** - Table might not exist or query malformed

## Fixes Applied

### 1. Duplicate Fields Cleanup
**File Created:** `supabase-cleanup-duplicate-fields.sql`

This SQL script will:
- Identify all duplicate `field_key` entries per table
- Delete duplicates, keeping only the first occurrence (lowest ID/earliest created_at)
- Add a unique constraint to prevent future duplicates

**To Apply:**
1. Go to Supabase Dashboard → SQL Editor
2. Run the script `supabase-cleanup-duplicate-fields.sql`
3. Verify no duplicates remain

### 2. Logo 404 Fix
**File Modified:** `lib/brand.ts`

Changed:
```typescript
logo: "/pm-logo.svg", // temporary until uploaded
```
To:
```typescript
logo: undefined, // Logo will be uploaded via Settings
```

This prevents 404 errors. The logo can be uploaded via Settings when ready.

### 3. needs_attention Query Fix
**Issue:** The URL parameter `?needs_attention=true` is not being parsed and applied as a filter in GridView.

**Status:** GridView currently doesn't read URL query parameters. The filter system uses `view_settings` table instead.

**Workaround:** The dashboard card click should navigate to the content grid, and users can manually add a filter for `needs_attention = true` using the filter panel.

**Future Fix:** Add URL parameter parsing to GridView to automatically apply filters from query string.

### 4. view_settings 404 Error
**Status:** The code in `lib/useViewSettings.ts` already handles this gracefully:
- If the table doesn't exist, it returns default settings
- Errors are logged but don't block the UI
- The warning is expected if the `view_settings` table hasn't been created yet

**To Fix:** Run the SQL migration `supabase-view-settings-migration.sql` in Supabase to create the table.

## Next Steps

1. **Run SQL Cleanup Script:**
   ```sql
   -- Run supabase-cleanup-duplicate-fields.sql in Supabase SQL Editor
   ```

2. **Verify view_settings Table Exists:**
   ```sql
   -- Check if table exists
   SELECT * FROM view_settings LIMIT 1;
   -- If it doesn't exist, run supabase-view-settings-migration.sql
   ```

3. **Test After Fixes:**
   - Check browser console - duplicate field warnings should be gone
   - Logo 404 errors should be gone
   - view_settings errors should be gone (or handled gracefully)
   - needs_attention filter can be added manually via filter panel

## Files Modified

- `lib/brand.ts` - Fixed logo reference
- `supabase-cleanup-duplicate-fields.sql` - New cleanup script

## Files to Review

- `components/views/GridView.tsx` - Consider adding URL parameter parsing for filters
- `supabase-view-settings-migration.sql` - Ensure this has been run in Supabase

