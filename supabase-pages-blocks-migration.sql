-- Add blocks field to pages table for composable interface blocks
-- This enables Airtable-style interface designer functionality

ALTER TABLE pages
  ADD COLUMN IF NOT EXISTS blocks jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN pages.blocks IS 'Array of block configurations for composable page layouts. Each block has: id, type, position (x, y, w, h), and settings.';

-- Create index for faster queries on blocks (if needed for filtering)
CREATE INDEX IF NOT EXISTS idx_pages_blocks ON pages USING gin (blocks);
