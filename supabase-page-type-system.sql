-- ============================================
-- PAGE TYPE SYSTEM - Step 1 Migration
-- ============================================
-- Adds page_type column to pages table
-- Supports Airtable-style page types: grid, record, kanban, gallery, calendar, form, chart, custom

-- Add page_type column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pages' AND column_name = 'page_type'
  ) THEN
    ALTER TABLE pages ADD COLUMN page_type TEXT NOT NULL DEFAULT 'custom';
    
    -- Add check constraint for allowed values
    ALTER TABLE pages ADD CONSTRAINT pages_page_type_check 
      CHECK (page_type IN ('grid', 'record', 'kanban', 'gallery', 'calendar', 'form', 'chart', 'custom'));
    
    -- Create index for page_type queries
    CREATE INDEX IF NOT EXISTS idx_pages_page_type ON pages(page_type);
    
    -- Migrate existing 'layout' values to 'page_type' where applicable
    -- Map old layout values to new page_type values
    UPDATE pages 
    SET page_type = CASE 
      WHEN layout = 'grid' THEN 'grid'
      WHEN layout = 'kanban' THEN 'kanban'
      WHEN layout = 'calendar' THEN 'calendar'
      WHEN layout = 'gallery' THEN 'gallery'
      WHEN layout = 'form' THEN 'form'
      WHEN layout = 'dashboard' THEN 'chart'  -- Dashboard maps to chart
      WHEN layout = 'list' THEN 'grid'  -- List maps to grid
      ELSE 'custom'
    END
    WHERE page_type = 'custom';  -- Only update if still default
    
  END IF;
END $$;
