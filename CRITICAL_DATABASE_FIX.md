# 🚨 CRITICAL: Database Tables Missing

## Problem
Multiple database tables are missing, causing 404 errors:
- `table_metadata` - Missing (causing table management errors)
- `dashboard_blocks` - Missing (causing dashboard block errors)
- Possibly others

## Solution: Run Complete Migration

You **MUST** run the complete database migration in Supabase SQL Editor.

### Steps:

1. **Open Supabase Dashboard**
   - Go to your Supabase project
   - Click on "SQL Editor" in the left sidebar

2. **Run the Complete Migration**
   - Open the file: `supabase-all-tables-migration.sql`
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click "Run" or press Ctrl+Enter

3. **Verify Tables Were Created**
   - After running, check the "Table Editor" in Supabase
   - You should see these tables:
     - `table_metadata`
     - `table_view_configs`
     - `dashboards`
     - `dashboard_modules`
     - `dashboard_blocks`
     - `comments`
     - `user_roles`

4. **Refresh Your Application**
   - Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)
   - The errors should be resolved

## What This Migration Does

The migration creates:
1. **table_metadata** - Stores table display names and descriptions
2. **table_view_configs** - Stores view configurations (filters, sorts, column settings)
3. **dashboards** - Main dashboard table
4. **dashboard_modules** - Dashboard widgets/modules
5. **dashboard_blocks** - Notion-style blocks for dashboard
6. **comments** - Comments on records
7. **user_roles** - User permission roles

All tables include:
- Proper indexes for performance
- Row Level Security (RLS) policies
- Default data where needed

## If Migration Fails

If you get errors about tables already existing:
- The migration uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times
- If specific tables already exist, those parts will be skipped
- Check the error message to see which table is causing issues

## Quick Fix for Just table_metadata

If you only need to fix `table_metadata` right now, run this:

```sql
CREATE TABLE IF NOT EXISTS table_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_table_metadata_table_name ON table_metadata(table_name);

ALTER TABLE table_metadata ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all table metadata" ON table_metadata;
DROP POLICY IF EXISTS "Users can create table metadata" ON table_metadata;
DROP POLICY IF EXISTS "Users can update table metadata" ON table_metadata;
DROP POLICY IF EXISTS "Users can delete table metadata" ON table_metadata;

CREATE POLICY "Users can view all table metadata" ON table_metadata
  FOR SELECT USING (true);

CREATE POLICY "Users can create table metadata" ON table_metadata
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update table metadata" ON table_metadata
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete table metadata" ON table_metadata
  FOR DELETE USING (true);

-- Insert default metadata
INSERT INTO table_metadata (table_name, display_name, description)
VALUES
  ('content', 'Content', 'Content items and articles'),
  ('campaigns', 'Campaigns', 'Marketing campaigns'),
  ('contacts', 'Contacts', 'Contact information'),
  ('ideas', 'Ideas', 'Creative ideas'),
  ('media', 'Media', 'Media assets'),
  ('tasks', 'Tasks', 'Task management'),
  ('briefings', 'Briefings', 'Project briefings'),
  ('sponsorships', 'Sponsorships', 'Sponsorship information'),
  ('strategy', 'Strategy', 'Strategic planning'),
  ('assets', 'Assets', 'Digital assets')
ON CONFLICT (table_name) DO NOTHING;
```

## After Running Migration

Once the migration is complete:
- All 404 errors should stop
- Table management should work
- Dashboard blocks should work
- Views should load properly

