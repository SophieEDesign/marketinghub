# 🚀 Dynamic System Migration Guide

## Current Issues
1. ❌ `pages` table doesn't exist (404 errors)
2. ❌ Hardcoded column references (`content.briefings`, `ideas.updated_at`, etc.)
3. ❌ System still using legacy hardcoded table/field structure

## Step 1: Run the Migration

### In Supabase SQL Editor:
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the **ENTIRE** contents of `supabase-dynamic-system-migration.sql`
5. Click **Run**

This will create:
- ✅ `tables` table (dynamic table definitions)
- ✅ `table_fields` table (dynamic field definitions)
- ✅ `pages` table (interface pages)
- ✅ `page_blocks` table (blocks within pages)
- ✅ `automations` table
- ✅ All RLS policies and triggers

## Step 2: Verify Migration

After running, check:
- ✅ All tables appear in Supabase Table Editor
- ✅ No errors in SQL Editor
- ✅ `pages` table exists and is accessible

## Step 3: Current System Status

**⚠️ IMPORTANT:** The current codebase still has hardcoded references that will cause errors until the full rebuild is complete:

- Hardcoded table names: `content`, `campaigns`, `ideas`, etc.
- Hardcoded field names: `briefings`, `updated_at`, etc.
- Legacy view system still in use

These will be fixed as we continue the rebuild process.

## Step 4: Next Steps (After Migration)

1. ✅ Migration complete (you are here)
2. ⏳ Create API routes for dynamic tables
3. ⏳ Create React pages for `/app/tables/` and `/app/pages/`
4. ⏳ Build interface builder UI
5. ⏳ Remove all hardcoded references
6. ⏳ Migrate existing data

## Temporary Workaround

Until the rebuild is complete, the app will show errors for:
- Pages that don't exist yet
- Hardcoded column references

This is expected and will be resolved as we implement the new dynamic system.

