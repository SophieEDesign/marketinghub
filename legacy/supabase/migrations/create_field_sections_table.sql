-- Migration: Create field_sections table for section-level settings
-- This table stores section definitions and settings separate from field group_name
-- Sections are first-class entities with their own settings

CREATE TABLE IF NOT EXISTS public.field_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT,
  order_index INTEGER NOT NULL DEFAULT 0 CHECK (order_index >= 0),
  default_collapsed BOOLEAN DEFAULT false,
  default_visible BOOLEAN DEFAULT true,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(table_id, name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_field_sections_table_id ON public.field_sections(table_id);
CREATE INDEX IF NOT EXISTS idx_field_sections_order_index ON public.field_sections(table_id, order_index);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_field_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS update_field_sections_updated_at ON public.field_sections;
CREATE TRIGGER update_field_sections_updated_at
  BEFORE UPDATE ON public.field_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_field_sections_updated_at();

-- RLS Policies
ALTER TABLE public.field_sections ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read field_sections
DROP POLICY IF EXISTS "Allow authenticated users to read field_sections" ON public.field_sections;
CREATE POLICY "Allow authenticated users to read field_sections"
  ON public.field_sections FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert field_sections
DROP POLICY IF EXISTS "Allow authenticated users to insert field_sections" ON public.field_sections;
CREATE POLICY "Allow authenticated users to insert field_sections"
  ON public.field_sections FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update field_sections
DROP POLICY IF EXISTS "Allow authenticated users to update field_sections" ON public.field_sections;
CREATE POLICY "Allow authenticated users to update field_sections"
  ON public.field_sections FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete field_sections
DROP POLICY IF EXISTS "Allow authenticated users to delete field_sections" ON public.field_sections;
CREATE POLICY "Allow authenticated users to delete field_sections"
  ON public.field_sections FOR DELETE
  TO authenticated
  USING (true);

-- Grant table privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.field_sections TO authenticated;

-- Function to auto-create sections from existing group_name values
-- This migration function helps migrate existing data
CREATE OR REPLACE FUNCTION migrate_existing_sections()
RETURNS void AS $$
DECLARE
  section_record RECORD;
  section_count INTEGER;
BEGIN
  -- Create sections for all unique group_name values in table_fields
  FOR section_record IN
    SELECT DISTINCT table_id, group_name
    FROM public.table_fields
    WHERE group_name IS NOT NULL AND group_name != ''
  LOOP
    -- Check if section already exists
    SELECT COUNT(*) INTO section_count
    FROM public.field_sections
    WHERE table_id = section_record.table_id AND name = section_record.group_name;
    
    -- Create section if it doesn't exist
    IF section_count = 0 THEN
      INSERT INTO public.field_sections (table_id, name, display_name, order_index)
      VALUES (
        section_record.table_id,
        section_record.group_name,
        section_record.group_name, -- Use group_name as display_name initially
        0 -- Default order_index, can be updated later
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the migration function
SELECT migrate_existing_sections();

-- Drop the migration function after use
DROP FUNCTION IF EXISTS migrate_existing_sections();
