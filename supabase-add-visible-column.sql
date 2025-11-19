-- ============================================
-- ADD VISIBLE COLUMN TO table_fields
-- Run this in Supabase SQL Editor if the visible column is missing
-- ============================================

-- Check if column exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'table_fields' 
    AND column_name = 'visible'
  ) THEN
    ALTER TABLE table_fields 
    ADD COLUMN visible BOOLEAN NOT NULL DEFAULT true;
    
    RAISE NOTICE 'Added visible column to table_fields';
  ELSE
    RAISE NOTICE 'visible column already exists';
  END IF;
END $$;

-- ============================================
-- VERIFY
-- ============================================
-- After running, check:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'table_fields' 
-- AND column_name = 'visible';
-- ============================================

