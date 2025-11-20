-- ============================================
-- CLEANUP DUPLICATE FIELDS IN table_fields
-- Run this in Supabase SQL Editor
-- ============================================
-- This script removes duplicate field_key entries, keeping only the first occurrence
-- (the one with the lowest ID or earliest created_at)

-- Step 1: Identify duplicates
-- Run this first to see what will be deleted:
SELECT 
  table_id,
  field_key,
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY created_at, id) as ids_to_keep_and_delete
FROM table_fields
GROUP BY table_id, field_key
HAVING COUNT(*) > 1
ORDER BY table_id, field_key;

-- Step 2: Delete duplicates (keeping the first occurrence)
-- This deletes all duplicates except the one with the lowest ID
DELETE FROM table_fields
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY table_id, field_key 
        ORDER BY created_at ASC, id ASC
      ) as row_num
    FROM table_fields
  ) ranked
  WHERE row_num > 1
);

-- Step 3: Verify cleanup
-- Run this to confirm no duplicates remain:
SELECT 
  table_id,
  field_key,
  COUNT(*) as count
FROM table_fields
GROUP BY table_id, field_key
HAVING COUNT(*) > 1;

-- If the above returns no rows, cleanup was successful!

-- Step 4: Add unique constraint to prevent future duplicates (if not already exists)
-- This will prevent duplicate field_key entries for the same table_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'table_fields_table_id_field_key_key'
  ) THEN
    ALTER TABLE table_fields 
    ADD CONSTRAINT table_fields_table_id_field_key_key 
    UNIQUE (table_id, field_key);
  END IF;
END $$;

