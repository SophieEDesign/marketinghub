-- Add settings column to pages table for page type configurations
-- This stores JSONB configuration for each page type (grid, record, kanban, etc.)

DO $$
BEGIN
  -- Add settings column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pages' AND column_name = 'settings'
  ) THEN
    ALTER TABLE pages ADD COLUMN settings JSONB DEFAULT '{}'::jsonb;
    
    -- Create index for settings queries
    CREATE INDEX IF NOT EXISTS idx_pages_settings ON pages USING GIN (settings);
  END IF;
END $$;
