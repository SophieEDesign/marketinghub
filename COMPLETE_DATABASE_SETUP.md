# 🚨 COMPLETE DATABASE SETUP REQUIRED

## Current Issues
Multiple database tables are missing, causing 500 errors:
- ❌ `table_metadata` - 404 errors
- ❌ `table_view_configs` - 500 errors on `/api/views`
- ❌ `dashboards` - 500 errors on `/api/dashboards`
- ❌ `dashboard_modules` - 500 errors on `/api/dashboard-modules`

## Solution: Run Complete Migration

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**

### Step 2: Run Complete Migration

**Copy and paste the ENTIRE contents of `supabase-all-tables-migration.sql`** into the SQL Editor and click **Run**.

This single migration will create:
- ✅ `table_metadata` table
- ✅ `table_view_configs` table
- ✅ `dashboards` table
- ✅ `dashboard_modules` table
- ✅ `dashboard_blocks` table (Phase 3)
- ✅ `comments` table (Phase 3)
- ✅ `user_roles` table (Phase 3)
- ✅ All indexes and RLS policies
- ✅ Default data

### Step 3: Verify
After running, check:
- ✅ No errors in SQL Editor
- ✅ All tables appear in Table Editor
- ✅ Refresh your app - all 500 errors should be gone

### Step 4: Test
1. Navigate to `/dashboard` - should load without errors
2. Navigate to `/content/grid` - should load without errors
3. Try creating a dashboard module - should work
4. Try creating a view - should work

## What This Fixes

✅ **Table Management** - Can create and manage tables
✅ **View System** - Views load and save correctly
✅ **Dashboard** - Dashboard loads and modules can be created
✅ **Phase 3 Features** - Blocks, comments, and permissions tables ready

## Alternative: Run Individual Migrations

If you prefer to run migrations separately:

1. `supabase-table-metadata-fix.sql` - Fixes table_metadata
2. `supabase-view-configs-migration.sql` - Fixes table_view_configs (if exists)
3. `supabase-dashboard-complete-migration.sql` - Fixes dashboards
4. `supabase-phase3-migrations.sql` - Phase 3 tables

But **`supabase-all-tables-migration.sql`** does everything in one go!

