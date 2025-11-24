-- Complete Dashboard Fix
-- This ensures both dashboard_blocks (new system) and dashboard_modules (old system) exist
-- Run this in Supabase SQL Editor

-- 1. Create dashboards table
CREATE TABLE IF NOT EXISTS dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create dashboard_blocks table (new system - used by Dashboard component)
CREATE TABLE IF NOT EXISTS dashboard_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('text', 'image', 'embed', 'kpi', 'table', 'calendar', 'html')),
  content JSONB DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create dashboard_modules table (old system - for backward compatibility)
CREATE TABLE IF NOT EXISTS dashboard_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 4,
  height INTEGER NOT NULL DEFAULT 4,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create indexes for dashboard_blocks
CREATE INDEX IF NOT EXISTS idx_dashboard_blocks_dashboard_id ON dashboard_blocks(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_blocks_position ON dashboard_blocks(dashboard_id, position);

-- 5. Create indexes for dashboard_modules
CREATE INDEX IF NOT EXISTS idx_dashboard_modules_dashboard_id ON dashboard_modules(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_modules_position ON dashboard_modules(dashboard_id, position_y, position_x);

-- 6. Enable RLS
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_modules ENABLE ROW LEVEL SECURITY;

-- 7. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view all dashboards" ON dashboards;
DROP POLICY IF EXISTS "Users can create dashboards" ON dashboards;
DROP POLICY IF EXISTS "Users can update dashboards" ON dashboards;
DROP POLICY IF EXISTS "Users can delete dashboards" ON dashboards;

DROP POLICY IF EXISTS "Users can view all dashboard blocks" ON dashboard_blocks;
DROP POLICY IF EXISTS "Users can create dashboard blocks" ON dashboard_blocks;
DROP POLICY IF EXISTS "Users can update dashboard blocks" ON dashboard_blocks;
DROP POLICY IF EXISTS "Users can delete dashboard blocks" ON dashboard_blocks;

DROP POLICY IF EXISTS "Users can view all dashboard modules" ON dashboard_modules;
DROP POLICY IF EXISTS "Users can create dashboard modules" ON dashboard_modules;
DROP POLICY IF EXISTS "Users can update dashboard modules" ON dashboard_modules;
DROP POLICY IF EXISTS "Users can delete dashboard modules" ON dashboard_modules;

-- 8. Create RLS Policies for dashboards
CREATE POLICY "Users can view all dashboards" ON dashboards
  FOR SELECT USING (true);

CREATE POLICY "Users can create dashboards" ON dashboards
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update dashboards" ON dashboards
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete dashboards" ON dashboards
  FOR DELETE USING (true);

-- 9. Create RLS Policies for dashboard_blocks
CREATE POLICY "Users can view all dashboard blocks" ON dashboard_blocks
  FOR SELECT USING (true);

CREATE POLICY "Users can create dashboard blocks" ON dashboard_blocks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update dashboard blocks" ON dashboard_blocks
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete dashboard blocks" ON dashboard_blocks
  FOR DELETE USING (true);

-- 10. Create RLS Policies for dashboard_modules
CREATE POLICY "Users can view all dashboard modules" ON dashboard_modules
  FOR SELECT USING (true);

CREATE POLICY "Users can create dashboard modules" ON dashboard_modules
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update dashboard modules" ON dashboard_modules
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete dashboard modules" ON dashboard_modules
  FOR DELETE USING (true);

-- 11. Create default dashboard if it doesn't exist
INSERT INTO dashboards (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Main Dashboard')
ON CONFLICT (id) DO NOTHING;

-- 12. Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 13. Create triggers for updated_at
DROP TRIGGER IF EXISTS update_dashboards_updated_at ON dashboards;
CREATE TRIGGER update_dashboards_updated_at
  BEFORE UPDATE ON dashboards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dashboard_blocks_updated_at ON dashboard_blocks;
CREATE TRIGGER update_dashboard_blocks_updated_at
  BEFORE UPDATE ON dashboard_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dashboard_modules_updated_at ON dashboard_modules;
CREATE TRIGGER update_dashboard_modules_updated_at
  BEFORE UPDATE ON dashboard_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

