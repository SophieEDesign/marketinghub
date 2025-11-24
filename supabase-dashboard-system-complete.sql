-- ============================================================================
-- COMPLETE DASHBOARD SYSTEM MIGRATION
-- ============================================================================
-- This migration ensures the dashboard system is fully functional
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. CREATE DASHBOARDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. CREATE DASHBOARD_BLOCKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS dashboard_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('text', 'image', 'embed', 'kpi', 'table', 'calendar', 'html')),
  content JSONB DEFAULT '{}'::jsonb NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT valid_content CHECK (
    (type = 'text' AND content ? 'html') OR
    (type = 'image' AND content ? 'url') OR
    (type = 'embed' AND content ? 'url') OR
    (type = 'kpi' AND content ? 'table') OR
    (type = 'table' AND content ? 'table') OR
    (type = 'calendar' AND content ? 'table') OR
    (type = 'html' AND content ? 'html') OR
    content = '{}'::jsonb
  )
);

-- 3. CREATE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_dashboards_id ON dashboards(id);
CREATE INDEX IF NOT EXISTS idx_dashboard_blocks_dashboard_id ON dashboard_blocks(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_blocks_position ON dashboard_blocks(dashboard_id, position);
CREATE INDEX IF NOT EXISTS idx_dashboard_blocks_type ON dashboard_blocks(type);

-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_blocks ENABLE ROW LEVEL SECURITY;

-- 5. DROP EXISTING POLICIES (to avoid conflicts)
-- ============================================================================
DROP POLICY IF EXISTS "Allow all users to view dashboards" ON dashboards;
DROP POLICY IF EXISTS "Allow all users to create dashboards" ON dashboards;
DROP POLICY IF EXISTS "Allow all users to update dashboards" ON dashboards;
DROP POLICY IF EXISTS "Allow all users to delete dashboards" ON dashboards;

DROP POLICY IF EXISTS "Allow all users to view dashboard blocks" ON dashboard_blocks;
DROP POLICY IF EXISTS "Allow all users to create dashboard blocks" ON dashboard_blocks;
DROP POLICY IF EXISTS "Allow all users to update dashboard blocks" ON dashboard_blocks;
DROP POLICY IF EXISTS "Allow all users to delete dashboard blocks" ON dashboard_blocks;

-- 6. CREATE RLS POLICIES FOR DASHBOARDS
-- ============================================================================
-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read" ON dashboards
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow all users to view dashboards (for backward compatibility)
CREATE POLICY "Allow all users to view dashboards" ON dashboards
  FOR SELECT USING (true);

CREATE POLICY "Allow all users to create dashboards" ON dashboards
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all users to update dashboards" ON dashboards
  FOR UPDATE USING (true);

CREATE POLICY "Allow all users to delete dashboards" ON dashboards
  FOR DELETE USING (true);

-- 7. CREATE RLS POLICIES FOR DASHBOARD_BLOCKS
-- ============================================================================
-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read" ON dashboard_blocks
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow all users to view dashboard blocks (for backward compatibility)
CREATE POLICY "Allow all users to view dashboard blocks" ON dashboard_blocks
  FOR SELECT USING (true);

CREATE POLICY "Allow all users to create dashboard blocks" ON dashboard_blocks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all users to update dashboard blocks" ON dashboard_blocks
  FOR UPDATE USING (true);

CREATE POLICY "Allow all users to delete dashboard blocks" ON dashboard_blocks
  FOR DELETE USING (true);

-- 8. CREATE UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. CREATE TRIGGERS FOR UPDATED_AT
-- ============================================================================
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

-- 10. CREATE DEFAULT DASHBOARD
-- ============================================================================
INSERT INTO dashboards (id, name, description)
VALUES ('00000000-0000-0000-0000-000000000001', 'Main Dashboard', 'Default dashboard')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

-- 11. VALIDATE CONTENT SCHEMA FUNCTION (for fixing broken content)
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_dashboard_block_content()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure content is not null
  IF NEW.content IS NULL THEN
    NEW.content := '{}'::jsonb;
  END IF;

  -- Fix content based on type
  CASE NEW.type
    WHEN 'text' THEN
      IF NOT (NEW.content ? 'html') THEN
        NEW.content := jsonb_build_object('html', COALESCE(NEW.content->>'html', ''));
      END IF;
    WHEN 'image' THEN
      IF NOT (NEW.content ? 'url') THEN
        NEW.content := jsonb_build_object(
          'url', COALESCE(NEW.content->>'url', ''),
          'caption', COALESCE(NEW.content->>'caption', '')
        );
      END IF;
    WHEN 'embed' THEN
      IF NOT (NEW.content ? 'url') THEN
        NEW.content := jsonb_build_object('url', COALESCE(NEW.content->>'url', ''));
      END IF;
    WHEN 'kpi' THEN
      IF NOT (NEW.content ? 'table') THEN
        NEW.content := jsonb_build_object(
          'table', COALESCE(NEW.content->>'table', ''),
          'label', COALESCE(NEW.content->>'label', 'Total Records'),
          'filter', COALESCE(NEW.content->>'filter', ''),
          'aggregate', COALESCE(NEW.content->>'aggregate', 'count')
        );
      END IF;
    WHEN 'table' THEN
      IF NOT (NEW.content ? 'table') THEN
        NEW.content := jsonb_build_object(
          'table', COALESCE(NEW.content->>'table', ''),
          'fields', COALESCE(NEW.content->'fields', '[]'::jsonb),
          'limit', COALESCE((NEW.content->>'limit')::integer, 5)
        );
      END IF;
    WHEN 'calendar' THEN
      IF NOT (NEW.content ? 'table') THEN
        NEW.content := jsonb_build_object(
          'table', COALESCE(NEW.content->>'table', ''),
          'dateField', COALESCE(NEW.content->>'dateField', 'publish_date'),
          'limit', COALESCE((NEW.content->>'limit')::integer, 5)
        );
      END IF;
    WHEN 'html' THEN
      IF NOT (NEW.content ? 'html') THEN
        NEW.content := jsonb_build_object('html', COALESCE(NEW.content->>'html', ''));
      END IF;
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. CREATE TRIGGER FOR CONTENT VALIDATION
-- ============================================================================
DROP TRIGGER IF EXISTS validate_dashboard_block_content_trigger ON dashboard_blocks;
CREATE TRIGGER validate_dashboard_block_content_trigger
  BEFORE INSERT OR UPDATE ON dashboard_blocks
  FOR EACH ROW
  EXECUTE FUNCTION validate_dashboard_block_content();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- The dashboard system is now ready to use.
-- Default dashboard ID: 00000000-0000-0000-0000-000000000001
-- ============================================================================

