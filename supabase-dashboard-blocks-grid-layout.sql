-- ============================================================================
-- ADD GRID LAYOUT COLUMNS TO DASHBOARD_BLOCKS
-- ============================================================================
-- This migration adds position_x, position_y, width, height columns
-- to support react-grid-layout functionality
-- ============================================================================

-- Add grid layout columns if they don't exist
DO $$ 
BEGIN
  -- Add position_x column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dashboard_blocks' AND column_name = 'position_x'
  ) THEN
    ALTER TABLE dashboard_blocks ADD COLUMN position_x INTEGER DEFAULT 0;
  END IF;

  -- Add position_y column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dashboard_blocks' AND column_name = 'position_y'
  ) THEN
    ALTER TABLE dashboard_blocks ADD COLUMN position_y INTEGER DEFAULT 0;
  END IF;

  -- Add width column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dashboard_blocks' AND column_name = 'width'
  ) THEN
    ALTER TABLE dashboard_blocks ADD COLUMN width INTEGER DEFAULT 4;
  END IF;

  -- Add height column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dashboard_blocks' AND column_name = 'height'
  ) THEN
    ALTER TABLE dashboard_blocks ADD COLUMN height INTEGER DEFAULT 4;
  END IF;
END $$;

-- Migrate existing position values to position_y
UPDATE dashboard_blocks 
SET position_y = position 
WHERE position_y = 0 AND position > 0;

-- Set default width and height for existing blocks
UPDATE dashboard_blocks 
SET width = 4, height = 4 
WHERE width IS NULL OR width = 0;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_dashboard_blocks_position_xy 
ON dashboard_blocks(dashboard_id, position_y, position_x);

