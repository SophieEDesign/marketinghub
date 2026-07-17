# Core Data Not Showing - Fix Guide

## Problem
The Core Data section in the sidebar is not displaying tables, even though they should be visible.

## Root Causes

1. **RLS Policies Missing or Incorrect**: Row Level Security policies may not be set up correctly on the `tables` table
2. **Migration Not Applied**: The migration that sets up RLS policies may not have been run
3. **No Tables in Database**: There may be no tables in the database
4. **Silent Errors**: Errors are being caught and returning empty arrays without logging

## Solutions Applied

### 1. Improved Error Logging
- Updated `baserow-app/lib/crud/tables.ts` to log detailed error information
- Updated `WorkspaceShellWrapper.tsx` to log when tables are loaded

### 2. Comprehensive Migration
- Created `supabase/migrations/ensure_core_data_visible.sql`
- This migration ensures:
  - RLS is enabled on `tables` and `table_rows` tables
  - Proper policies are created for authenticated users
  - Policies allow SELECT, INSERT, UPDATE, DELETE operations

### 3. Diagnostic SQL Script
- Created `CHECK_CORE_DATA_ACCESS.sql` to help diagnose issues

## Steps to Fix

### Step 1: Run the Diagnostic Script
Run `CHECK_CORE_DATA_ACCESS.sql` or `VERIFY_TABLES_AND_RLS.sql` in your Supabase SQL editor to check:
- If tables exist in the database
- If RLS policies are set up correctly
- Current user and role

**Note**: `VERIFY_TABLES_AND_RLS.sql` provides a more comprehensive check with status messages.

### Step 2: Apply the Migration
Run the migration `supabase/migrations/ensure_core_data_visible.sql` in your Supabase SQL editor.

**Important**: Make sure you're running this as a user with sufficient permissions (typically the service role or database owner).

### Step 3: Verify Tables Exist
Check if you have any tables in your database:
```sql
SELECT id, name, supabase_table FROM public.tables;
```

If no tables exist, you'll need to create some tables first (either through the UI or SQL).

### Step 4: Check Browser Console
After applying the migration, check your browser console for:
- `[getTables] Successfully loaded tables: X` - This confirms tables are loading
- Any error messages starting with `[getTables]` or `[WorkspaceShellWrapper]`

### Step 5: Verify RLS Policies
Run this query to verify policies exist:
```sql
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'tables'
  AND policyname = 'Authenticated users can view all tables';
```

You should see at least one policy with `cmd = 'SELECT'` and `roles = '{authenticated}'`.

## Common Issues

### Issue: "PGRST301" or "permission denied" errors
**Solution**: RLS policies are not set up correctly. Run the migration `ensure_core_data_visible.sql`.

### Issue: Tables exist but don't show in sidebar
**Solution**: 
1. Check browser console for errors
2. Verify RLS policies are correct (see Step 5)
3. Ensure you're logged in as an authenticated user

### Issue: No tables in database
**Solution**: Create tables through the Settings > Data tab or via SQL.

### Issue: Migration fails
**Solution**: 
- Make sure you're running as a user with CREATE POLICY permissions
- Check if policies already exist and need to be dropped first
- Look for specific error messages in the migration output

## Testing

After applying the fix:
1. Refresh your browser
2. Check the sidebar - you should see "Core Data" section (may be collapsed)
3. Click to expand "Core Data" - you should see your tables listed
4. Check browser console - should see `[getTables] Successfully loaded tables: X`

## Files Modified

1. `baserow-app/lib/crud/tables.ts` - Added error logging
2. `baserow-app/components/layout/WorkspaceShellWrapper.tsx` - Added error logging
3. `supabase/migrations/ensure_core_data_visible.sql` - New migration file
4. `CHECK_CORE_DATA_ACCESS.sql` - Diagnostic script
5. `VERIFY_TABLES_AND_RLS.sql` - Comprehensive verification script (run after migration)
