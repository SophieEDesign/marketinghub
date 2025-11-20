-- ============================================
-- FIX SUPABASE SETTINGS & TABLE_FIELDS RLS POLICIES
-- Run this in Supabase SQL Editor
-- Fixes RLS policies for settings and table_fields tables
-- ============================================

-- ============================================
-- SETTINGS TABLE POLICIES
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to settings" ON settings;
DROP POLICY IF EXISTS "Allow public write access to settings" ON settings;
DROP POLICY IF EXISTS "Allow public update access to settings" ON settings;
DROP POLICY IF EXISTS "Allow public delete access to settings" ON settings;

-- Create policies for settings table
CREATE POLICY "Allow public read access to settings"
ON settings FOR SELECT
USING (true);

CREATE POLICY "Allow public write access to settings"
ON settings FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update access to settings"
ON settings FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public delete access to settings"
ON settings FOR DELETE
USING (true);

-- ============================================
-- TABLE_FIELDS TABLE POLICIES
-- ============================================

-- Ensure table_fields table exists
CREATE TABLE IF NOT EXISTS table_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL,
  options JSONB,
  "order" INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT false,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(table_id, field_key)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_table_fields_table_id ON table_fields(table_id);
CREATE INDEX IF NOT EXISTS idx_table_fields_order ON table_fields(table_id, "order");

-- Ensure RLS is enabled
ALTER TABLE table_fields ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to table_fields" ON table_fields;
DROP POLICY IF EXISTS "Allow public write access to table_fields" ON table_fields;
DROP POLICY IF EXISTS "Allow public update access to table_fields" ON table_fields;
DROP POLICY IF EXISTS "Allow public delete access to table_fields" ON table_fields;

-- Create policies for table_fields table
CREATE POLICY "Allow public read access to table_fields"
ON table_fields FOR SELECT
USING (true);

CREATE POLICY "Allow public write access to table_fields"
ON table_fields FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update access to table_fields"
ON table_fields FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public delete access to table_fields"
ON table_fields FOR DELETE
USING (true);

-- ============================================
-- VERIFY SETUP
-- ============================================
-- After running this:
-- 1. Check settings table: SELECT * FROM settings LIMIT 5;
-- 2. Check table_fields table: SELECT * FROM table_fields LIMIT 5;
-- 3. Test creating a field in the UI
-- 4. Test updating settings in the UI
-- 5. Check browser console for detailed error logs
-- ============================================

