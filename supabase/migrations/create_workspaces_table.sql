-- Migration: Create workspaces table for workspace settings

-- Workspaces: Single workspace configuration
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY DEFAULT 'default',
  name TEXT NOT NULL DEFAULT 'Marketing Hub',
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default workspace if it doesn't exist
INSERT INTO workspaces (id, name, icon)
VALUES ('default', 'Marketing Hub', '📊')
ON CONFLICT (id) DO NOTHING;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_workspaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_workspaces_updated_at();

-- RLS Policies (allow authenticated users to read/update)
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read workspace"
  ON workspaces FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to update workspace"
  ON workspaces FOR UPDATE
  TO authenticated
  USING (true);
