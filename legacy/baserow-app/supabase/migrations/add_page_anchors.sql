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
-- First, update any existing blank pages to 'overview' type
-- Note: This runs before anchor columns are added, so we can't check for anchors yet
UPDATE interface_pages
SET page_type = 'overview'
WHERE page_type = 'blank';

-- 4. Migrate existing pages to have anchors BEFORE adding the constraint
-- This ensures existing pages are valid when the constraint is enforced

-- For dashboard/overview pages, set dashboard_layout_id to the page's id (self-reference)
UPDATE interface_pages ip
SET dashboard_layout_id = ip.id
WHERE ip.page_type IN ('dashboard', 'overview')
  AND ip.dashboard_layout_id IS NULL;

-- Note: Pages with other types will need manual configuration via the setup state
-- The constraint will allow pages without anchors temporarily, then we'll enforce it

-- 5. Add CHECK constraint function to ensure exactly one anchor exists per page
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

-- Drop trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS enforce_page_anchor ON interface_pages;

-- Create trigger (only enforces on INSERT/UPDATE, not on existing data)
CREATE TRIGGER enforce_page_anchor
  BEFORE INSERT OR UPDATE ON interface_pages
  FOR EACH ROW
  EXECUTE FUNCTION check_page_anchor();

-- Note: update_interface_pages_updated_at trigger already exists from create_interface_pages_system.sql
-- No need to recreate it - it's handled by the previous migration

-- 6. Update page_type CHECK constraint to remove 'blank'
-- First, find and drop the existing constraint (it might have a different name)
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Find the constraint name
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'interface_pages'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%page_type%';
  
  -- Drop it if found
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE interface_pages DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END IF;
END $$;

-- Add the new constraint without 'blank'
ALTER TABLE interface_pages
  ADD CONSTRAINT interface_pages_page_type_check
  CHECK (page_type IN (
    'list', 'gallery', 'kanban', 'calendar', 'timeline', 
    'form', 'dashboard', 'overview', 'record_review'
  ));

-- 7. Add comments
COMMENT ON COLUMN interface_pages.saved_view_id IS 'Anchor for list/gallery/kanban/calendar/timeline/record_review pages. References a saved view.';
COMMENT ON COLUMN interface_pages.dashboard_layout_id IS 'Anchor for dashboard/overview pages. References view_blocks.view_id where blocks are stored.';
COMMENT ON COLUMN interface_pages.form_config_id IS 'Anchor for form pages. Form configuration is stored in config JSONB.';
COMMENT ON COLUMN interface_pages.record_config_id IS 'Anchor for record_review pages. Configuration stored in config JSONB.';

