-- ============================================
-- VIEW SETTINGS TABLE MIGRATION
-- Run this in Supabase SQL Editor
-- ============================================

-- Create view_settings table for persisting filters and sorts per view
CREATE TABLE IF NOT EXISTS view_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id TEXT NOT NULL,
  view_id TEXT NOT NULL,
  filters JSONB DEFAULT '[]'::jsonb,
  sort JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(table_id, view_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_view_settings_table_view ON view_settings(table_id, view_id);
CREATE INDEX IF NOT EXISTS idx_view_settings_updated_at ON view_settings(updated_at);

-- Enable RLS
ALTER TABLE view_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow public read access to view_settings" ON view_settings;
CREATE POLICY "Allow public read access to view_settings" ON view_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access to view_settings" ON view_settings;
CREATE POLICY "Allow public write access to view_settings" ON view_settings
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to view_settings" ON view_settings;
CREATE POLICY "Allow public update access to view_settings" ON view_settings
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete access to view_settings" ON view_settings;
CREATE POLICY "Allow public delete access to view_settings" ON view_settings
  FOR DELETE USING (true);

-- ============================================
-- VERIFY SETUP
-- ============================================
-- After running, check:
-- SELECT * FROM view_settings;
-- Should return empty result (no rows yet)
-- ============================================

