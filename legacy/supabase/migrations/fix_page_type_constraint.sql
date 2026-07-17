-- Migration: Fix page_type constraint to include all valid page types
-- This migration is idempotent and ensures the constraint matches the current schema
-- It should be run to fix any constraint issues from previous migrations

-- Drop existing constraint if it exists
ALTER TABLE interface_pages
  DROP CONSTRAINT IF EXISTS interface_pages_page_type_check;

-- Add constraint with all allowed page types
-- This includes both unified architecture types (content, record_view) and legacy types
ALTER TABLE interface_pages
  ADD CONSTRAINT interface_pages_page_type_check 
  CHECK (page_type = ANY (ARRAY[
    'list'::text, 
    'gallery'::text, 
    'kanban'::text, 
    'calendar'::text, 
    'timeline'::text, 
    'form'::text, 
    'dashboard'::text, 
    'overview'::text, 
    'record_review'::text, 
    'content'::text,
    'record_view'::text
  ]));

-- Update comment to reflect all supported types
COMMENT ON COLUMN interface_pages.page_type IS 'Page visualization type. Unified architecture uses: content (block-based pages) and record_view (pages with recordId context). Legacy types maintained for backward compatibility.';
