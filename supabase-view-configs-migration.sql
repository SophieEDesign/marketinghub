-- ============================================
-- VIEW CONFIGS TABLE MIGRATION
-- Run this in Supabase SQL Editor
-- Creates table for saving Airtable-style views
-- ============================================

-- Create table_view_configs table
CREATE TABLE IF NOT EXISTS table_view_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  view_name TEXT NOT NULL,
  view_type TEXT NOT NULL DEFAULT 'grid', -- grid, kanban, calendar, timeline, cards
  column_order JSONB DEFAULT '[]'::jsonb,
  column_widths JSONB DEFAULT '{}'::jsonb,
  hidden_columns JSONB DEFAULT '[]'::jsonb,
  filters JSONB DEFAULT '[]'::jsonb,
  sort JSONB DEFAULT '[]'::jsonb,
  groupings JSONB DEFAULT '[]'::jsonb, -- Field groups structure
  row_height TEXT DEFAULT 'medium', -- compact, medium, tall
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(table_name, view_name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_table_view_configs_table_name ON table_view_configs(table_name);
CREATE INDEX IF NOT EXISTS idx_table_view_configs_default ON table_view_configs(table_name, is_default) WHERE is_default = true;

-- Enable RLS
ALTER TABLE table_view_configs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to table_view_configs" ON table_view_configs;
DROP POLICY IF EXISTS "Allow public write access to table_view_configs" ON table_view_configs;
DROP POLICY IF EXISTS "Allow public update access to table_view_configs" ON table_view_configs;
DROP POLICY IF EXISTS "Allow public delete access to table_view_configs" ON table_view_configs;

-- Create policies for table_view_configs table
CREATE POLICY "Allow public read access to table_view_configs"
ON table_view_configs FOR SELECT
USING (true);

CREATE POLICY "Allow public write access to table_view_configs"
ON table_view_configs FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update access to table_view_configs"
ON table_view_configs FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public delete access to table_view_configs"
ON table_view_configs FOR DELETE
USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_table_view_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_table_view_configs_updated_at ON table_view_configs;
CREATE TRIGGER update_table_view_configs_updated_at
  BEFORE UPDATE ON table_view_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_table_view_configs_updated_at();

-- ============================================
-- VERIFY SETUP
-- ============================================
-- After running, check:
-- SELECT * FROM table_view_configs;
-- Should return empty result (no views yet)
-- ============================================

