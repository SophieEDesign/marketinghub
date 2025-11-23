-- ============================================
-- COMPLETE DATABASE MIGRATION
-- Run this in Supabase SQL Editor to fix all 500 errors
-- ============================================

-- 1. TABLE_METADATA TABLE
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

-- 2. TABLE_VIEW_CONFIGS TABLE
CREATE TABLE IF NOT EXISTS table_view_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  view_name TEXT NOT NULL,
  view_type TEXT NOT NULL DEFAULT 'grid',
  column_order JSONB DEFAULT '[]'::jsonb,
  column_widths JSONB DEFAULT '{}'::jsonb,
  hidden_columns JSONB DEFAULT '[]'::jsonb,
  filters JSONB DEFAULT '[]'::jsonb,
  sort JSONB DEFAULT '[]'::jsonb,
  groupings JSONB DEFAULT '[]'::jsonb,
  row_height TEXT DEFAULT 'medium',
  is_default BOOLEAN DEFAULT false,
  card_fields JSONB DEFAULT '[]'::jsonb,
  kanban_group_field TEXT,
  calendar_date_field TEXT,
  timeline_date_field TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(table_name, view_name)
);

CREATE INDEX IF NOT EXISTS idx_table_view_configs_table_name ON table_view_configs(table_name);
CREATE INDEX IF NOT EXISTS idx_table_view_configs_default ON table_view_configs(table_name, is_default) WHERE is_default = true;

ALTER TABLE table_view_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to table_view_configs" ON table_view_configs;
DROP POLICY IF EXISTS "Allow public write access to table_view_configs" ON table_view_configs;
DROP POLICY IF EXISTS "Allow public update access to table_view_configs" ON table_view_configs;
DROP POLICY IF EXISTS "Allow public delete access to table_view_configs" ON table_view_configs;

CREATE POLICY "Allow public read access to table_view_configs"
ON table_view_configs FOR SELECT
USING (true);

CREATE POLICY "Allow public write access to table_view_configs"
ON table_view_configs FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update access to table_view_configs"
ON table_view_configs FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete access to table_view_configs"
ON table_view_configs FOR DELETE
USING (true);

-- 3. DASHBOARDS TABLE
CREATE TABLE IF NOT EXISTS dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DASHBOARD_MODULES TABLE
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

CREATE INDEX IF NOT EXISTS idx_dashboard_modules_dashboard_id ON dashboard_modules(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_modules_position ON dashboard_modules(dashboard_id, position_y, position_x);

ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all dashboards" ON dashboards;
DROP POLICY IF EXISTS "Users can create dashboards" ON dashboards;
DROP POLICY IF EXISTS "Users can update dashboards" ON dashboards;
DROP POLICY IF EXISTS "Users can delete dashboards" ON dashboards;

DROP POLICY IF EXISTS "Users can view all dashboard modules" ON dashboard_modules;
DROP POLICY IF EXISTS "Users can create dashboard modules" ON dashboard_modules;
DROP POLICY IF EXISTS "Users can update dashboard modules" ON dashboard_modules;
DROP POLICY IF EXISTS "Users can delete dashboard modules" ON dashboard_modules;

CREATE POLICY "Users can view all dashboards" ON dashboards
  FOR SELECT USING (true);

CREATE POLICY "Users can create dashboards" ON dashboards
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update dashboards" ON dashboards
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete dashboards" ON dashboards
  FOR DELETE USING (true);

CREATE POLICY "Users can view all dashboard modules" ON dashboard_modules
  FOR SELECT USING (true);

CREATE POLICY "Users can create dashboard modules" ON dashboard_modules
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update dashboard modules" ON dashboard_modules
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete dashboard modules" ON dashboard_modules
  FOR DELETE USING (true);

-- Create default dashboard
INSERT INTO dashboards (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Main Dashboard')
ON CONFLICT (id) DO NOTHING;

-- 5. DASHBOARD_BLOCKS TABLE (Phase 3)
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

-- 6. COMMENTS TABLE (Phase 3)
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

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all comments" ON comments;
DROP POLICY IF EXISTS "Users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can update own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;

CREATE POLICY "Users can view all comments" ON comments
  FOR SELECT USING (true);

CREATE POLICY "Users can create comments" ON comments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own comments" ON comments
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can delete own comments" ON comments
  FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- 7. USER_ROLES TABLE (Phase 3)
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON user_roles;

CREATE POLICY "Users can view all roles" ON user_roles
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage roles" ON user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 8. CONTENT TABLE (Main data table)
CREATE TABLE IF NOT EXISTS content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT,
  channels TEXT[] DEFAULT '{}',
  publish_date DATE,
  content_type TEXT,
  thumbnail_url TEXT,
  campaign_id UUID,
  assigned_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
CREATE INDEX IF NOT EXISTS idx_content_publish_date ON content(publish_date);
CREATE INDEX IF NOT EXISTS idx_content_campaign_id ON content(campaign_id);

ALTER TABLE content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all content" ON content;
DROP POLICY IF EXISTS "Users can create content" ON content;
DROP POLICY IF EXISTS "Users can update content" ON content;
DROP POLICY IF EXISTS "Users can delete content" ON content;

CREATE POLICY "Users can view all content" ON content
  FOR SELECT USING (true);

CREATE POLICY "Users can create content" ON content
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update content" ON content
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete content" ON content
  FOR DELETE USING (true);

-- 9. CAMPAIGNS TABLE
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT,
  colour TEXT,
  start_date DATE,
  end_date DATE,
  assignee TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can create campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can update campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can delete campaigns" ON campaigns;

CREATE POLICY "Users can view all campaigns" ON campaigns
  FOR SELECT USING (true);

CREATE POLICY "Users can create campaigns" ON campaigns
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update campaigns" ON campaigns
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete campaigns" ON campaigns
  FOR DELETE USING (true);

-- 10. OTHER DATA TABLES (basic structure)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication TEXT,
  url TEXT,
  date DATE,
  notes TEXT,
  content_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT,
  due_date DATE,
  assigned_to TEXT,
  content_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  content_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sponsorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS strategy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  content_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all data tables
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Create policies for all data tables (allow all operations)
DO $$
DECLARE
  table_name TEXT;
  tables TEXT[] := ARRAY['contacts', 'ideas', 'media', 'tasks', 'briefings', 'sponsorships', 'strategy', 'assets'];
BEGIN
  FOREACH table_name IN ARRAY tables
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users can view all %s" ON %I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Users can create %s" ON %I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Users can update %s" ON %I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Users can delete %s" ON %I', table_name, table_name);
    
    EXECUTE format('CREATE POLICY "Users can view all %s" ON %I FOR SELECT USING (true)', table_name, table_name);
    EXECUTE format('CREATE POLICY "Users can create %s" ON %I FOR INSERT WITH CHECK (true)', table_name, table_name);
    EXECUTE format('CREATE POLICY "Users can update %s" ON %I FOR UPDATE USING (true)', table_name, table_name);
    EXECUTE format('CREATE POLICY "Users can delete %s" ON %I FOR DELETE USING (true)', table_name, table_name);
  END LOOP;
END $$;

