-- Phase 3: Workspace Blocks System Migrations

-- 1. Dashboard Blocks Table
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

-- Enable RLS
ALTER TABLE dashboard_blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dashboard_blocks
CREATE POLICY "Users can view all dashboard blocks" ON dashboard_blocks
  FOR SELECT USING (true);

CREATE POLICY "Users can create dashboard blocks" ON dashboard_blocks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update dashboard blocks" ON dashboard_blocks
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete dashboard blocks" ON dashboard_blocks
  FOR DELETE USING (true);

-- 2. Comments Table
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  text TEXT NOT NULL,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_record ON comments(record_id, table_name);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);

-- Enable RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comments
CREATE POLICY "Users can view all comments" ON comments
  FOR SELECT USING (true);

CREATE POLICY "Users can create comments" ON comments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own comments" ON comments
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can delete own comments" ON comments
  FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- 3. User Roles Table
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roles
CREATE POLICY "Users can view all roles" ON user_roles
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage roles" ON user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Add notes field to all tables (will be handled via table_fields, but we can add a default)
-- Note: This is handled dynamically via table_fields, so no migration needed here

