-- ============================================
-- CLEANUP ORPHANED FIELDS
-- Removes field records that don't have matching tables
-- Run this after deleting tables to clean up orphaned fields
-- ============================================

-- First, check which column name exists in your table_fields table
-- Run this query first to see your schema:
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'table_fields' 
  AND column_name IN ('name', 'field_key')
ORDER BY column_name;

-- Step 1: Find and delete fields where table_id doesn't match any table UUID
-- This handles the case where table_id might be stored as TEXT (old system)
DELETE FROM table_fields
WHERE table_id::text NOT IN (
  SELECT id::text FROM tables
);

-- Step 2: Also delete fields where table_id is a TEXT value (old system)
-- that doesn't match any table name
DELETE FROM table_fields tf
WHERE NOT EXISTS (
  SELECT 1 FROM tables t 
  WHERE t.id::text = tf.table_id::text 
     OR t.name = tf.table_id::text
)
AND tf.table_id::text NOT SIMILAR TO '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

-- Step 3: Show remaining orphaned fields (for verification)
-- IMPORTANT: 
-- - If your table_fields has a 'name' column, use: tf.name
-- - If your table_fields has a 'field_key' column, use: tf.field_key
-- - Check the result of the query above to see which one you have

-- Version A: If your table has 'name' column (old schema)
SELECT 
  tf.id,
  tf.table_id,
  tf.name,
  tf.label,
  CASE 
    WHEN EXISTS (SELECT 1 FROM tables t WHERE t.id::text = tf.table_id::text) THEN 'Valid UUID'
    WHEN EXISTS (SELECT 1 FROM tables t WHERE t.name = tf.table_id::text) THEN 'Table name (needs migration)'
    ELSE 'ORPHANED - will be deleted'
  END as status
FROM table_fields tf
WHERE NOT EXISTS (
  SELECT 1 FROM tables t 
  WHERE t.id::text = tf.table_id::text
);

-- Version B: If your table has 'field_key' column (new schema)
-- Uncomment this and comment Version A if you have 'field_key':
/*
SELECT 
  tf.id,
  tf.table_id,
  tf.field_key,
  tf.label,
  CASE 
    WHEN EXISTS (SELECT 1 FROM tables t WHERE t.id::text = tf.table_id::text) THEN 'Valid UUID'
    WHEN EXISTS (SELECT 1 FROM tables t WHERE t.name = tf.table_id::text) THEN 'Table name (needs migration)'
    ELSE 'ORPHANED - will be deleted'
  END as status
FROM table_fields tf
WHERE NOT EXISTS (
  SELECT 1 FROM tables t 
  WHERE t.id::text = tf.table_id::text
);
*/

-- ============================================
-- ALTERNATIVE: Nuclear option - Delete ALL fields and start fresh
-- Only use this if you want to completely reset all field definitions
-- ============================================
-- TRUNCATE TABLE table_fields CASCADE;
