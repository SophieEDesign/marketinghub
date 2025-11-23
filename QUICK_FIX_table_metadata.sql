-- Quick fix for missing table_metadata table
-- Run this in Supabase SQL Editor if you only need to fix table_metadata

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

