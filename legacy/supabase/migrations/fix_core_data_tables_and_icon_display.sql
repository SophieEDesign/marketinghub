-- Migration: Fix Core Data Tables Access and Icon Display
-- This ensures tables are visible and icons display correctly in sidebar

-- ============================================================================
-- 1. ENSURE TABLES ARE ACCESSIBLE TO AUTHENTICATED USERS
-- ============================================================================

-- Enable RLS on tables if not already enabled
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- Drop any conflicting policies first
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'tables'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tables', r.policyname);
  END LOOP;
END $$;

-- Create policy for authenticated users to view all tables
CREATE POLICY "Authenticated users can view all tables"
  ON public.tables
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to create tables
CREATE POLICY "Authenticated users can create tables"
  ON public.tables
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update tables
CREATE POLICY "Authenticated users can update tables"
  ON public.tables
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- 2. ENSURE TABLE_ROWS ARE ACCESSIBLE
-- ============================================================================

-- Enable RLS on table_rows if not already enabled
ALTER TABLE public.table_rows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'table_rows'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.table_rows', r.policyname);
  END LOOP;
END $$;

-- Create policy for authenticated users to view all rows
CREATE POLICY "Authenticated users can view all rows"
  ON public.table_rows
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert rows
CREATE POLICY "Authenticated users can insert rows"
  ON public.table_rows
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update rows
CREATE POLICY "Authenticated users can update rows"
  ON public.table_rows
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to delete rows
CREATE POLICY "Authenticated users can delete rows"
  ON public.table_rows
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- 3. ENSURE INTERFACE_GROUPS ICON COLUMN EXISTS AND IS UPDATABLE
-- ============================================================================

-- Ensure icon column exists in interface_groups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'interface_groups' 
    AND column_name = 'icon'
  ) THEN
    ALTER TABLE public.interface_groups
      ADD COLUMN icon text;
    
    COMMENT ON COLUMN public.interface_groups.icon IS 'Lucide icon name for the interface group (e.g., Calendar, Folder, etc.)';
  END IF;
END $$;

-- Ensure RLS allows updates to interface_groups icon
DO $$
BEGIN
  -- Check if update policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'interface_groups'
    AND policyname LIKE '%update%'
  ) THEN
    -- Create update policy if it doesn't exist
    CREATE POLICY "Authenticated users can update interface groups"
      ON public.interface_groups
      FOR UPDATE
      TO authenticated
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- ============================================================================
-- 4. ENSURE INTERFACE_PAGES CONFIG CAN BE UPDATED
-- ============================================================================

-- Ensure RLS allows updates to interface_pages config
DO $$
BEGIN
  -- Check if update policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'interface_pages'
    AND policyname LIKE '%update%'
  ) THEN
    -- Create update policy if it doesn't exist
    CREATE POLICY "Authenticated users can update interface pages"
      ON public.interface_pages
      FOR UPDATE
      TO authenticated
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Authenticated users can view all tables" ON public.tables IS 
  'All authenticated users can view tables for the Core Data section. Admin-only restrictions are enforced in application logic.';

COMMENT ON POLICY "Authenticated users can view all rows" ON public.table_rows IS 
  'All authenticated users can view table rows. Admin-only restrictions are enforced in application logic.';
