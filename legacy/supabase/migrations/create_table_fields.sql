-- Migration: Create table_fields table for field metadata
-- This table stores field definitions separate from the physical database schema
-- Required for CSV import and field management functionality

CREATE TABLE IF NOT EXISTS public.table_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- Human-friendly display name (can differ from internal `name`)
  label TEXT,
  type TEXT NOT NULL CHECK (type IN (
    'text', 'long_text', 'number', 'percent', 'currency', 'date',
    'single_select', 'multi_select', 'checkbox', 'attachment',
    'link_to_table', 'formula', 'lookup', 'url', 'email', 'json'
  )),
  position INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0,
  group_name TEXT,
  required BOOLEAN DEFAULT FALSE,
  default_value JSONB,
  options JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(table_id, name)
);

-- Backfill/upgrade: ensure newer columns exist on older installs
ALTER TABLE public.table_fields ADD COLUMN IF NOT EXISTS label TEXT;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_table_fields_table_id ON public.table_fields(table_id);
CREATE INDEX IF NOT EXISTS idx_table_fields_position ON public.table_fields(table_id, position);
CREATE INDEX IF NOT EXISTS idx_table_fields_order_index ON public.table_fields(table_id, order_index);
CREATE INDEX IF NOT EXISTS idx_table_fields_group ON public.table_fields(table_id, group_name);

-- RLS Policies (if RLS is enabled)
ALTER TABLE public.table_fields ENABLE ROW LEVEL SECURITY;

-- Table privileges (RLS policies do not grant privileges by themselves)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.table_fields TO authenticated;

-- Allow authenticated users to read table_fields
DROP POLICY IF EXISTS "Allow authenticated users to read table_fields" ON public.table_fields;
CREATE POLICY "Allow authenticated users to read table_fields"
  ON public.table_fields
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert table_fields
DROP POLICY IF EXISTS "Allow authenticated users to insert table_fields" ON public.table_fields;
CREATE POLICY "Allow authenticated users to insert table_fields"
  ON public.table_fields
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update table_fields
DROP POLICY IF EXISTS "Allow authenticated users to update table_fields" ON public.table_fields;
CREATE POLICY "Allow authenticated users to update table_fields"
  ON public.table_fields
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete table_fields
DROP POLICY IF EXISTS "Allow authenticated users to delete table_fields" ON public.table_fields;
CREATE POLICY "Allow authenticated users to delete table_fields"
  ON public.table_fields
  FOR DELETE
  TO authenticated
  USING (true);

-- Function to get table columns from information_schema
CREATE OR REPLACE FUNCTION public.get_table_columns(table_name text)
RETURNS TABLE(column_name text, data_type text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::text,
    c.data_type::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = get_table_columns.table_name
    AND c.column_name NOT IN ('id', 'created_at', 'updated_at')
  ORDER BY c.ordinal_position;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_table_columns(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_columns(text) TO anon;

-- Function to execute SQL safely (for field operations)
CREATE OR REPLACE FUNCTION public.execute_sql_safe(sql_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_sql_safe(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_sql_safe(text) TO anon;
