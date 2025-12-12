-- ============================================
-- PAGE ACTIONS SYSTEM - Step 4 Migration
-- ============================================
-- Adds actions field to pages table for page-level actions
-- Supports Airtable-style action buttons and quick automations

-- Add actions column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pages' AND column_name = 'actions'
  ) THEN
    ALTER TABLE pages ADD COLUMN actions JSONB DEFAULT '[]'::jsonb;
    
    -- Create index for actions queries
    CREATE INDEX IF NOT EXISTS idx_pages_actions ON pages USING GIN (actions);
    
    -- Add comment
    COMMENT ON COLUMN pages.actions IS 'Array of page-level actions (buttons, record actions, quick automations)';
  END IF;
END $$;

-- Add quick_automations column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pages' AND column_name = 'quick_automations'
  ) THEN
    ALTER TABLE pages ADD COLUMN quick_automations JSONB DEFAULT '[]'::jsonb;
    
    -- Create index for quick_automations queries
    CREATE INDEX IF NOT EXISTS idx_pages_quick_automations ON pages USING GIN (quick_automations);
    
    -- Add comment
    COMMENT ON COLUMN pages.quick_automations IS 'Array of per-page mini automations (triggers + actions)';
  END IF;
END $$;
