-- Migration: Add blocks support to nc_views table
-- This enables block-based interface pages for each view

ALTER TABLE nc_views
  ADD COLUMN IF NOT EXISTS blocks jsonb DEFAULT '[]'::jsonb;

-- Create index for faster queries on blocks
CREATE INDEX IF NOT EXISTS idx_nc_views_blocks ON nc_views USING gin (blocks);

-- Add comment for documentation
COMMENT ON COLUMN nc_views.blocks IS 'Array of block configurations for interface pages. Each block has: id, type, position (x, y, w, h), and settings.';
