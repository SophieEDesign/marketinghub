-- Migration: Add sidebar_text_color to workspace_settings table
-- This allows customization of the sidebar text color

-- Add sidebar_text_color column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'workspace_settings' 
    AND column_name = 'sidebar_text_color'
  ) THEN
    ALTER TABLE public.workspace_settings
      ADD COLUMN sidebar_text_color text;
  END IF;
END $$;
