-- Migration: Add horizontal_grouped view type
-- This adds 'horizontal_grouped' to the views.type CHECK constraint

-- Drop the existing constraint
ALTER TABLE public.views
DROP CONSTRAINT IF EXISTS views_type_check;

-- Recreate the constraint with the new view type
ALTER TABLE public.views
ADD CONSTRAINT views_type_check 
CHECK (type = ANY (ARRAY[
  'grid'::text, 
  'kanban'::text, 
  'calendar'::text, 
  'form'::text, 
  'interface'::text, 
  'gallery'::text, 
  'timeline'::text,
  'horizontal_grouped'::text
]));
