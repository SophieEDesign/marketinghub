-- Migration: Add url, email, and json field types to table_fields CHECK constraint
-- These field types were added to the application but the database constraint wasn't updated

-- Drop the existing constraint
ALTER TABLE public.table_fields 
  DROP CONSTRAINT IF EXISTS table_fields_type_check;

-- Add the updated constraint with url, email, and json included
ALTER TABLE public.table_fields 
  ADD CONSTRAINT table_fields_type_check 
  CHECK (type IN (
    'text', 'long_text', 'number', 'percent', 'currency', 'date',
    'single_select', 'multi_select', 'checkbox', 'attachment',
    'link_to_table', 'formula', 'lookup', 'url', 'email', 'json'
  ));
