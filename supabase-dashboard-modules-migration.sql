-- Create dashboards table
CREATE TABLE IF NOT EXISTS dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create dashboard_modules table
CREATE TABLE IF NOT EXISTS dashboard_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- "kpi", "pipeline", "calendar", "tasks", "table_preview", "custom_embed", etc.
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 4,
  height INTEGER NOT NULL DEFAULT 4,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_dashboard_modules_dashboard_id ON dashboard_modules(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_modules_position ON dashboard_modules(dashboard_id, position_y, position_x);

-- Enable RLS
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_modules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dashboards
CREATE POLICY "Users can view all dashboards" ON dashboards
  FOR SELECT USING (true);

CREATE POLICY "Users can create dashboards" ON dashboards
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update dashboards" ON dashboards
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete dashboards" ON dashboards
  FOR DELETE USING (true);

-- RLS Policies for dashboard_modules
CREATE POLICY "Users can view all dashboard modules" ON dashboard_modules
  FOR SELECT USING (true);

CREATE POLICY "Users can create dashboard modules" ON dashboard_modules
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update dashboard modules" ON dashboard_modules
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete dashboard modules" ON dashboard_modules
  FOR DELETE USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
CREATE TRIGGER update_dashboards_updated_at
  BEFORE UPDATE ON dashboards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_modules_updated_at
  BEFORE UPDATE ON dashboard_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default dashboard
INSERT INTO dashboards (id, name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Main Dashboard')
ON CONFLICT (id) DO NOTHING;

