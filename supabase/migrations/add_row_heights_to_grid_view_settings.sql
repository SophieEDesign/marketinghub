-- Migration: Add per-row height overrides to grid_view_settings
-- Stores user-resized row heights per view (record_id -> pixel height)

ALTER TABLE public.grid_view_settings
  ADD COLUMN IF NOT EXISTS row_heights JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.grid_view_settings.row_heights IS
  'JSON object mapping record id (string) to row height in pixels';

