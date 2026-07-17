-- Migration: Add interface settings fields to views table
-- This enables per-interface configuration for default_view and hide_view_switcher

-- Add default_view column (stores view_id of default view for this interface)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'views' 
    AND column_name = 'default_view'
  ) THEN
    ALTER TABLE public.views
      ADD COLUMN default_view uuid REFERENCES public.views(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add hide_view_switcher column (boolean to hide view switcher in interface)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'views' 
    AND column_name = 'hide_view_switcher'
  ) THEN
    ALTER TABLE public.views
      ADD COLUMN hide_view_switcher boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Create index for default_view lookups
CREATE INDEX IF NOT EXISTS idx_views_default_view ON public.views(default_view);

COMMENT ON COLUMN public.views.default_view IS 'Default view_id to show when opening this interface';
COMMENT ON COLUMN public.views.hide_view_switcher IS 'If true, hide the view switcher in the interface';
