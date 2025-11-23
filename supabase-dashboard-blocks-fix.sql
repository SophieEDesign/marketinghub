-- Quick fix for missing dashboard_blocks table
-- Run this in Supabase SQL Editor

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

