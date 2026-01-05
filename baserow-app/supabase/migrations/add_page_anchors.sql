-- Migration: Add Page Anchors System
-- Every page must have exactly one anchor: saved_view_id, dashboard_layout_id, form_config_id, or record_config_id
-- This prevents invalid page states and ensures every page can be edited.

-- 1. Add anchor columns to interface_pages
ALTER TABLE interface_pages
  ADD COLUMN IF NOT EXISTS saved_view_id UUID REFERENCES views(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS dashboard_layout_id UUID, -- References view_blocks via view_id (dashboard pages)
  ADD COLUMN IF NOT EXISTS form_config_id UUID, -- For form pages (stored in config, but we track it)
  ADD COLUMN IF NOT EXISTS record_config_id UUID; -- For record review pages (stored in config)

-- 2. Add indexes for anchor columns
CREATE INDEX IF NOT EXISTS idx_interface_pages_saved_view_id ON interface_pages(saved_view_id) WHERE saved_view_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interface_pages_dashboard_layout_id ON interface_pages(dashboard_layout_id) WHERE dashboard_layout_id IS NOT NULL;

-- 3. Remove 'blank' from page_type CHECK constraint (blank pages are invalid)
-- First, update any existing blank pages to have a default anchor or mark them for deletion
UPDATE interface_pages
SET page_type = 'overview'
WHERE page_type = 'blank' AND dashboard_layout_id IS NULL AND saved_view_id IS NULL;

-- 4. Add CHECK constraint to ensure exactly one anchor exists per page
-- Note: We use a function to check this because PostgreSQL CHECK constraints can't easily count NULLs
CREATE OR REPLACE FUNCTION check_page_anchor()
RETURNS TRIGGER AS $$
BEGIN
  -- Count non-null anchors
  IF (
    (NEW.saved_view_id IS NOT NULL)::int +
    (NEW.dashboard_layout_id IS NOT NULL)::int +
    (NEW.form_config_id IS NOT NULL)::int +
    (NEW.record_config_id IS NOT NULL)::int
  ) != 1 THEN
    RAISE EXCEPTION 'Page must have exactly one anchor: saved_view_id, dashboard_layout_id, form_config_id, or record_config_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS enforce_page_anchor ON interface_pages;

-- Create trigger
CREATE TRIGGER enforce_page_anchor
  BEFORE INSERT OR UPDATE ON interface_pages
  FOR EACH ROW
  EXECUTE FUNCTION check_page_anchor();

-- 5. Update page_type CHECK constraint to remove 'blank'
ALTER TABLE interface_pages
  DROP CONSTRAINT IF EXISTS interface_pages_page_type_check;

ALTER TABLE interface_pages
  ADD CONSTRAINT interface_pages_page_type_check
  CHECK (page_type IN (
    'list', 'gallery', 'kanban', 'calendar', 'timeline', 
    'form', 'dashboard', 'overview', 'record_review'
  ));

-- 6. Migrate existing pages to have anchors where possible
-- For pages with source_view, try to find or create a matching view
-- For dashboard/overview pages, set dashboard_layout_id to the page's view_id (if blocks exist)
UPDATE interface_pages ip
SET dashboard_layout_id = (
  SELECT vb.view_id
  FROM view_blocks vb
  WHERE vb.view_id = ip.id
  LIMIT 1
)
WHERE ip.page_type IN ('dashboard', 'overview')
  AND ip.dashboard_layout_id IS NULL
  AND EXISTS (
    SELECT 1 FROM view_blocks vb WHERE vb.view_id = ip.id
  );

-- For pages with source_view (SQL view name), we can't automatically create a saved_view_id
-- These will need manual migration or we create a placeholder view
-- For now, we'll leave them and the setup state will prompt for configuration

-- 7. Add comments
COMMENT ON COLUMN interface_pages.saved_view_id IS 'Anchor for list/gallery/kanban/calendar/timeline/record_review pages. References a saved view.';
COMMENT ON COLUMN interface_pages.dashboard_layout_id IS 'Anchor for dashboard/overview pages. References view_blocks.view_id where blocks are stored.';
COMMENT ON COLUMN interface_pages.form_config_id IS 'Anchor for form pages. Form configuration is stored in config JSONB.';
COMMENT ON COLUMN interface_pages.record_config_id IS 'Anchor for record_review pages. Configuration stored in config JSONB.';

