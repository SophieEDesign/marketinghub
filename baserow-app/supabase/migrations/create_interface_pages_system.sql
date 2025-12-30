-- Migration: Create Interface Pages System (Airtable-style)
-- Pages reference SQL views, not templates. Page types are visualizations only.

-- 1. Create interface_pages table
CREATE TABLE IF NOT EXISTS interface_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  page_type TEXT NOT NULL CHECK (page_type IN (
    'list', 'gallery', 'kanban', 'calendar', 'timeline', 
    'form', 'dashboard', 'overview', 'record_review', 'blank'
  )),
  source_view TEXT,        -- SQL view name (for list, gallery, kanban, calendar, timeline, dashboard, record_review)
  base_table TEXT,         -- Only used for forms (table name)
  config JSONB DEFAULT '{}'::jsonb,
  group_id UUID REFERENCES interface_groups(id) ON DELETE SET NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_admin_only BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_interface_pages_page_type ON interface_pages(page_type);
CREATE INDEX IF NOT EXISTS idx_interface_pages_source_view ON interface_pages(source_view) WHERE source_view IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interface_pages_group_id ON interface_pages(group_id);
CREATE INDEX IF NOT EXISTS idx_interface_pages_order ON interface_pages(group_id, order_index);

-- Update trigger for updated_at
CREATE TRIGGER update_interface_pages_updated_at
  BEFORE UPDATE ON interface_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE interface_pages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to read interface pages"
  ON interface_pages
  FOR SELECT
  TO authenticated
  USING (
    NOT is_admin_only OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Allow admins to manage interface pages"
  ON interface_pages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 2. Migrate existing interface views to interface_pages
-- This migration assumes existing views with type='interface' should become interface_pages
INSERT INTO interface_pages (id, name, page_type, source_view, config, group_id, order_index, created_at, updated_at, created_by, is_admin_only)
SELECT 
  v.id,
  v.name,
  COALESCE(v.page_type, 'blank')::TEXT,
  NULL, -- source_view will need to be set manually or via config
  COALESCE(v.config, '{}'::jsonb),
  v.group_id,
  v.order_index,
  v.created_at,
  v.updated_at,
  v.owner_id,
  COALESCE(v.is_admin_only, FALSE)
FROM views v
WHERE v.type = 'interface'
ON CONFLICT (id) DO NOTHING;

-- 3. Add comments for documentation
COMMENT ON TABLE interface_pages IS 'Interface pages that reference SQL views. Page types are visualizations only.';
COMMENT ON COLUMN interface_pages.page_type IS 'Visualization type: list, gallery, kanban, calendar, timeline, form, dashboard, overview, record_review, blank';
COMMENT ON COLUMN interface_pages.source_view IS 'SQL view name that provides the data. Used for all page types except form and blank.';
COMMENT ON COLUMN interface_pages.base_table IS 'Base table name. Only used for form page type.';
COMMENT ON COLUMN interface_pages.config IS 'JSONB configuration for visualization settings, filters, grouping, etc.';

