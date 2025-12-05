-- ============================================
-- FIX TABLE_FIELDS SCHEMA
-- Updates table_fields to use UUID table_id that references tables(id)
-- ============================================

-- First, check if table_fields exists with old schema (table_id as TEXT)
-- If it does, we need to migrate it

-- Step 1: Create a backup of existing data (if any)
CREATE TABLE IF NOT EXISTS table_fields_backup AS 
SELECT * FROM table_fields;

-- Step 2: Drop the old table_fields if it has TEXT table_id
-- Note: This will delete all existing field definitions!
-- Only run this if you're sure you want to start fresh
-- DROP TABLE IF EXISTS table_fields CASCADE;

-- Step 3: Create the correct table_fields schema
CREATE TABLE IF NOT EXISTS table_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- field name (e.g., "title", "status")
  label TEXT NOT NULL, -- display label (e.g., "Title", "Status")
  type TEXT NOT NULL, -- 'text', 'number', 'date', 'single_select', 'multi_select', 'checkbox', 'url', 'email', 'phone', 'attachment', 'linked_record', 'formula', 'rollup', etc.
  options JSONB DEFAULT '{}'::jsonb, -- type-specific options (choices for select, format for date, etc.)
  required BOOLEAN DEFAULT false,
  unique_field BOOLEAN DEFAULT false,
  "order" INTEGER DEFAULT 0, -- display order
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(table_id, name)
);

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_table_fields_table_id ON table_fields(table_id);
CREATE INDEX IF NOT EXISTS idx_table_fields_order ON table_fields(table_id, "order");

-- Step 5: Enable RLS
ALTER TABLE table_fields ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies
DROP POLICY IF EXISTS "Users can view all table_fields" ON table_fields;
DROP POLICY IF EXISTS "Users can create table_fields" ON table_fields;
DROP POLICY IF EXISTS "Users can update table_fields" ON table_fields;
DROP POLICY IF EXISTS "Users can delete table_fields" ON table_fields;

CREATE POLICY "Users can view all table_fields" ON table_fields FOR SELECT USING (true);
CREATE POLICY "Users can create table_fields" ON table_fields FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update table_fields" ON table_fields FOR UPDATE USING (true);
CREATE POLICY "Users can delete table_fields" ON table_fields FOR DELETE USING (true);

-- Step 7: Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_table_fields_updated_at ON table_fields;
CREATE TRIGGER update_table_fields_updated_at
  BEFORE UPDATE ON table_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION NOTES
-- ============================================

-- If you have existing data in table_fields with TEXT table_id:
-- 1. You'll need to map table names to UUIDs from the tables table
-- 2. Update the table_fields_backup table to use UUIDs
-- 3. Then insert the migrated data back

-- Example migration query (if you have existing data):
-- INSERT INTO table_fields (table_id, name, label, type, options, required, "order", created_at)
-- SELECT 
--   t.id as table_id,
--   tf.field_key as name,
--   tf.label,
--   tf.type,
--   tf.options,
--   tf.required,
--   tf."order",
--   tf.created_at
-- FROM table_fields_backup tf
-- JOIN tables t ON t.name = tf.table_id;
