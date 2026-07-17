-- Migration: Add 'record_view' page type
-- Record View pages are canvas pages with injected recordId context for blocks
-- This replaces 'record_review' in the unified architecture

-- Add 'record_view' to page_type constraint
ALTER TABLE interface_pages
  DROP CONSTRAINT IF EXISTS interface_pages_page_type_check;

ALTER TABLE interface_pages
  ADD CONSTRAINT interface_pages_page_type_check 
  CHECK (page_type IN ('list', 'gallery', 'kanban', 'calendar', 'timeline', 'form', 'dashboard', 'overview', 'record_review', 'content', 'record_view'));

-- Update comment
COMMENT ON COLUMN interface_pages.page_type IS 'Page visualization type. Unified architecture uses: content (block-based pages) and record_view (pages with recordId context). Legacy types maintained for backward compatibility.';
