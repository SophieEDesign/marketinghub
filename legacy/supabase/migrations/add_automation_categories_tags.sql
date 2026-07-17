-- Migration: Add category and tags to automations table
-- This allows users to organize automations by category and add flexible tags

-- Add category column (text field for predefined categories)
ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS category text;

-- Add tags column (JSONB array for flexible tagging)
ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;

-- Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_automations_category ON public.automations(category) WHERE category IS NOT NULL;

-- Create GIN index for tags array searching
CREATE INDEX IF NOT EXISTS idx_automations_tags ON public.automations USING GIN (tags) WHERE tags IS NOT NULL AND jsonb_array_length(tags) > 0;

-- Add comment for documentation
COMMENT ON COLUMN public.automations.category IS 'Predefined category for organizing automations (e.g., Notifications, Data Sync, Cleanup)';
COMMENT ON COLUMN public.automations.tags IS 'Flexible tags array for custom organization and filtering';
