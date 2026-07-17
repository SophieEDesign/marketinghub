-- Migration: Ensure 'record_view' page type is allowed
-- This migration is idempotent and safe to run multiple times
-- It ensures the interface_pages_page_type_check constraint includes 'record_view'

-- Drop existing constraint if it exists
ALTER TABLE interface_pages
  DROP CONSTRAINT IF EXISTS interface_pages_page_type_check;

-- Add constraint with all allowed page types including 'record_view'
ALTER TABLE interface_pages
  ADD CONSTRAINT interface_pages_page_type_check 
  CHECK (page_type IN (
    'list', 
    'gallery', 
    'kanban', 
    'calendar', 
    'timeline', 
    'form', 
    'dashboard', 
    'overview', 
    'record_review', 
    'content', 
    'record_view'
  ));

-- Update comment
COMMENT ON COLUMN interface_pages.page_type IS 'Page visualization type. Unified architecture uses: content (block-based pages) and record_view (pages with recordId context). Legacy types maintained for backward compatibility.';
