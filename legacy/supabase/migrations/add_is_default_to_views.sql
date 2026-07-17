-- Migration: Add is_default column to views table for interface-first navigation

-- Add is_default column (only one interface can be default)
ALTER TABLE public.views
  ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

-- Create unique partial index to ensure only one default interface
CREATE UNIQUE INDEX IF NOT EXISTS views_one_default_interface
  ON public.views (is_default)
  WHERE is_default = true AND type = 'interface';

-- Add comment
COMMENT ON COLUMN public.views.is_default IS 'Marks an interface page as the default landing page';
