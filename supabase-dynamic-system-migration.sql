-- ============================================
-- DYNAMIC SYSTEM MIGRATION
-- Complete rebuild: Dynamic Tables + Pages + Blocks
-- Removes hardcoded tables and views system
-- ============================================

-- ============================================
-- 1. DYNAMIC TABLES SYSTEM
-- ============================================

-- Tables (user-created, no hardcoding)
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- table name (e.g., "campaigns", "content")
  label TEXT NOT NULL, -- display name (e.g., "Campaigns", "Content")
  description TEXT DEFAULT '',
  icon TEXT DEFAULT 'table', -- icon name for UI
  color TEXT DEFAULT '#6366f1', -- brand color
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tables_name ON tables(name);
CREATE INDEX IF NOT EXISTS idx_tables_created_at ON tables(created_at);

-- Table Fields (dynamic fields per table)
CREATE TABLE IF NOT EXISTS table_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- field name (e.g., "title", "status")
  label TEXT NOT NULL, -- display label (e.g., "Title", "Status")
  type TEXT NOT NULL, -- 'text', 'number', 'date', 'single_select', 'multi_select', 'checkbox', 'url', 'email', 'phone', 'attachment', 'linked_record', 'formula', 'rollup', etc.
  options JSONB DEFAULT '{}'::jsonb, -- type-specific options (choices for select, format for date, etc.)
  required BOOLEAN DEFAULT false,
  unique_field BOOLEAN DEFAULT false,
  "order" INTEGER DEFAULT 0, -- display order
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(table_id, name)
);

CREATE INDEX IF NOT EXISTS idx_table_fields_table_id ON table_fields(table_id);
CREATE INDEX IF NOT EXISTS idx_table_fields_order ON table_fields(table_id, "order");

-- ============================================
-- 2. PAGES SYSTEM (Interfaces)
-- ============================================

-- Pages (replaces views system)
CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'layout', -- icon name (optional)
  layout TEXT DEFAULT 'custom', -- 'blank', 'dashboard', 'list', 'kanban', 'custom', etc. (template)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pages_created_at ON pages(created_at);

-- Page Blocks (Airtable-style blocks)
-- Note: Using position_x/position_y/width/height for compatibility with existing code
-- Can be migrated to x/y/w/h later if needed
CREATE TABLE IF NOT EXISTS page_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'grid', 'kanban', 'calendar', 'timeline', 'gallery', 'list', 'chart', 'kpi', 'text', 'image', 'button', 'record_picker', 'filter', 'divider'
  position_x INTEGER DEFAULT 0, -- grid x position (legacy, can migrate to x later)
  position_y INTEGER DEFAULT 0, -- grid y position (legacy, can migrate to y later)
  width INTEGER DEFAULT 12, -- width (grid columns 1-12) (legacy, can migrate to w later)
  height INTEGER DEFAULT 6, -- height (grid rows) (legacy, can migrate to h later)
  config JSONB DEFAULT '{}'::jsonb, -- { table, fields, filters, sort, group, calendar_date_field, kanban_group_field, etc. }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_blocks_page_id ON page_blocks(page_id);
CREATE INDEX IF NOT EXISTS idx_page_blocks_position ON page_blocks(page_id, position_y, position_x);

-- ============================================
-- 3. AUTOMATIONS SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  trigger JSONB NOT NULL, -- { type: 'record_created' | 'record_updated' | 'schedule', table?: string, schedule?: 'daily' | 'weekly', etc. }
  actions JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ type: 'send_email' | 'update_record' | 'create_record' | 'webhook', ... }]
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations(enabled) WHERE enabled = true;

-- ============================================
-- 4. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

-- Tables policies
DROP POLICY IF EXISTS "Users can view all tables" ON tables;
DROP POLICY IF EXISTS "Users can create tables" ON tables;
DROP POLICY IF EXISTS "Users can update tables" ON tables;
DROP POLICY IF EXISTS "Users can delete tables" ON tables;

CREATE POLICY "Users can view all tables" ON tables FOR SELECT USING (true);
CREATE POLICY "Users can create tables" ON tables FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update tables" ON tables FOR UPDATE USING (true);
CREATE POLICY "Users can delete tables" ON tables FOR DELETE USING (true);

-- Table Fields policies
DROP POLICY IF EXISTS "Users can view all table_fields" ON table_fields;
DROP POLICY IF EXISTS "Users can create table_fields" ON table_fields;
DROP POLICY IF EXISTS "Users can update table_fields" ON table_fields;
DROP POLICY IF EXISTS "Users can delete table_fields" ON table_fields;

CREATE POLICY "Users can view all table_fields" ON table_fields FOR SELECT USING (true);
CREATE POLICY "Users can create table_fields" ON table_fields FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update table_fields" ON table_fields FOR UPDATE USING (true);
CREATE POLICY "Users can delete table_fields" ON table_fields FOR DELETE USING (true);

-- Pages policies
DROP POLICY IF EXISTS "Users can view all pages" ON pages;
DROP POLICY IF EXISTS "Users can create pages" ON pages;
DROP POLICY IF EXISTS "Users can update pages" ON pages;
DROP POLICY IF EXISTS "Users can delete pages" ON pages;

CREATE POLICY "Users can view all pages" ON pages FOR SELECT USING (true);
CREATE POLICY "Users can create pages" ON pages FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update pages" ON pages FOR UPDATE USING (true);
CREATE POLICY "Users can delete pages" ON pages FOR DELETE USING (true);

-- Page Blocks policies
DROP POLICY IF EXISTS "Users can view all page_blocks" ON page_blocks;
DROP POLICY IF EXISTS "Users can create page_blocks" ON page_blocks;
DROP POLICY IF EXISTS "Users can update page_blocks" ON page_blocks;
DROP POLICY IF EXISTS "Users can delete page_blocks" ON page_blocks;

CREATE POLICY "Users can view all page_blocks" ON page_blocks FOR SELECT USING (true);
CREATE POLICY "Users can create page_blocks" ON page_blocks FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update page_blocks" ON page_blocks FOR UPDATE USING (true);
CREATE POLICY "Users can delete page_blocks" ON page_blocks FOR DELETE USING (true);

-- Automations policies
DROP POLICY IF EXISTS "Users can view all automations" ON automations;
DROP POLICY IF EXISTS "Users can create automations" ON automations;
DROP POLICY IF EXISTS "Users can update automations" ON automations;
DROP POLICY IF EXISTS "Users can delete automations" ON automations;

CREATE POLICY "Users can view all automations" ON automations FOR SELECT USING (true);
CREATE POLICY "Users can create automations" ON automations FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update automations" ON automations FOR UPDATE USING (true);
CREATE POLICY "Users can delete automations" ON automations FOR DELETE USING (true);

-- ============================================
-- 5. AUTO-UPDATE TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_tables_updated_at ON tables;
DROP TRIGGER IF EXISTS update_table_fields_updated_at ON table_fields;
DROP TRIGGER IF EXISTS update_pages_updated_at ON pages;
DROP TRIGGER IF EXISTS update_page_blocks_updated_at ON page_blocks;
DROP TRIGGER IF EXISTS update_automations_updated_at ON automations;

CREATE TRIGGER update_tables_updated_at
  BEFORE UPDATE ON tables
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_table_fields_updated_at
  BEFORE UPDATE ON table_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pages_updated_at
  BEFORE UPDATE ON pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_page_blocks_updated_at
  BEFORE UPDATE ON page_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automations_updated_at
  BEFORE UPDATE ON automations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. MIGRATION NOTES
-- ============================================

-- This migration creates the foundation for a fully dynamic system.
-- Legacy tables (table_metadata, table_view_configs, dashboard_modules, dashboard_blocks)
-- should be deprecated but kept for backward compatibility during migration.
-- 
-- Next steps:
-- 1. Create API routes for tables, table_fields, pages, page_blocks
-- 2. Create React pages for /app/tables/ and /app/pages/
-- 3. Build interface builder UI
-- 4. Migrate existing data from legacy tables
-- 5. Remove legacy code references

