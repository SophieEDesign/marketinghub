# URGENT: Dashboard Blocks Table Missing

## Error
The `dashboard_blocks` table is missing from your Supabase database, causing 404 errors when trying to add blocks to the dashboard.

## Solution

Run this SQL in your Supabase SQL Editor:

```sql
-- Create dashboard_blocks table
CREATE TABLE IF NOT EXISTS dashboard_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('text', 'image', 'embed')),
  content JSONB DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_blocks_dashboard_id ON dashboard_blocks(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_blocks_position ON dashboard_blocks(dashboard_id, position);

ALTER TABLE dashboard_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all dashboard blocks" ON dashboard_blocks;
DROP POLICY IF EXISTS "Users can create dashboard blocks" ON dashboard_blocks;
DROP POLICY IF EXISTS "Users can update dashboard blocks" ON dashboard_blocks;
DROP POLICY IF EXISTS "Users can delete dashboard blocks" ON dashboard_blocks;

CREATE POLICY "Users can view all dashboard blocks" ON dashboard_blocks
  FOR SELECT USING (true);

CREATE POLICY "Users can create dashboard blocks" ON dashboard_blocks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update dashboard blocks" ON dashboard_blocks
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete dashboard blocks" ON dashboard_blocks
  FOR DELETE USING (true);
```

## Alternative: Run Complete Migration

If you haven't run the complete migration yet, use `supabase-all-tables-migration.sql` which includes all necessary tables including `dashboard_blocks`.

## Steps

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Paste the SQL above (or run `supabase-all-tables-migration.sql`)
4. Click "Run"
5. Refresh your application

