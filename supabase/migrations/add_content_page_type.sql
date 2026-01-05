-- Migration: Add 'content' page type for non-data pages
-- Content Pages are user-facing, block-based pages that do not require data sources
-- and are used for documentation and resources.

-- Add 'content' to page_type constraint
ALTER TABLE interface_pages
  DROP CONSTRAINT IF EXISTS interface_pages_page_type_check;

ALTER TABLE interface_pages
  ADD CONSTRAINT interface_pages_page_type_check 
  CHECK (page_type IN ('list', 'gallery', 'kanban', 'calendar', 'timeline', 'form', 'dashboard', 'overview', 'record_review', 'content'));

-- Add comment
COMMENT ON COLUMN interface_pages.page_type IS 'Page visualization type. Content pages are block-based pages without data sources.';

