-- Fix dashboard_blocks table to support all block types and grid layout
-- This migration:
-- 1. Adds missing grid layout columns (position_x, position_y, width, height)
-- 2. Updates the type check constraint to include all 7 block types

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
    ALTER TABLE dashboard_blocks ADD COLUMN width INTEGER DEFAULT 3;
  END IF;
  
  -- Add height column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dashboard_blocks' AND column_name = 'height'
  ) THEN
    ALTER TABLE dashboard_blocks ADD COLUMN height INTEGER DEFAULT 3;
  END IF;
END $$;

-- Drop the old check constraint if it exists
ALTER TABLE dashboard_blocks DROP CONSTRAINT IF EXISTS dashboard_blocks_type_check;

-- Add new check constraint with all 7 block types
ALTER TABLE dashboard_blocks 
  ADD CONSTRAINT dashboard_blocks_type_check 
  CHECK (type = ANY (ARRAY[
    'text'::text, 
    'image'::text, 
    'embed'::text, 
    'kpi'::text, 
    'table'::text, 
    'calendar'::text, 
    'html'::text
  ]));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_dashboard_blocks_position_x ON dashboard_blocks(position_x);
CREATE INDEX IF NOT EXISTS idx_dashboard_blocks_position_y ON dashboard_blocks(position_y);
CREATE INDEX IF NOT EXISTS idx_dashboard_blocks_dashboard_id ON dashboard_blocks(dashboard_id);

