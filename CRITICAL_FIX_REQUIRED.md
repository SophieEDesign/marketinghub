# 🚨 CRITICAL FIX REQUIRED

## Issue
The `table_metadata` table is missing from your Supabase database, causing 404 errors when trying to:
- Load table metadata
- Create new tables
- Manage table fields

## Solution

**Run this SQL in your Supabase SQL Editor:**

```sql
-- Create table_metadata table if it doesn't exist
CREATE TABLE IF NOT EXISTS table_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_table_metadata_table_name ON table_metadata(table_name);

-- Enable RLS
ALTER TABLE table_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policies for table_metadata
CREATE POLICY "Users can view all table metadata" ON table_metadata
  FOR SELECT USING (true);

CREATE POLICY "Users can create table metadata" ON table_metadata
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update table metadata" ON table_metadata
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete table metadata" ON table_metadata
  FOR DELETE USING (true);

-- Insert default metadata for existing tables
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

## After Running the Fix

1. Refresh your browser
2. The 404 errors should stop
3. You should be able to create new tables
4. Continue with Phase 3 implementation

## Files Created
- `supabase-table-metadata-fix.sql` - Complete migration file
- `supabase-phase3-migrations.sql` - Phase 3 tables (run after fixing table_metadata)

