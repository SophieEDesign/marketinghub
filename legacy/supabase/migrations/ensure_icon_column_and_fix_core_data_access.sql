-- Migration: Ensure icon column exists and fix Core Data access
-- This fixes 400 errors from missing icon column and ensures tables are accessible

-- ============================================================================
-- 1. ENSURE ICON COLUMN EXISTS IN INTERFACE_GROUPS
-- ============================================================================

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
    
    COMMENT ON COLUMN public.interface_groups.icon IS 'Lucide icon name for the interface (e.g., Calendar, Folder, etc.)';
  END IF;
END $$;

-- ============================================================================
-- 2. ENSURE TABLES TABLE HAS PROPER RLS POLICIES FOR CORE DATA ACCESS
-- ============================================================================

-- Enable RLS on tables if not already enabled
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might be too restrictive
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'tables'
    AND policyname != 'Authenticated users can view all tables'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tables', r.policyname);
  END LOOP;
END $$;

-- Ensure authenticated users can view all tables (for Core Data section)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'tables'
    AND policyname = 'Authenticated users can view all tables'
  ) THEN
    CREATE POLICY "Authenticated users can view all tables"
      ON public.tables
      FOR SELECT
      TO authenticated
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- ============================================================================
-- 3. ENSURE TABLE_ROWS HAS PROPER RLS POLICIES
-- ============================================================================

-- Enable RLS on table_rows if not already enabled
ALTER TABLE public.table_rows ENABLE ROW LEVEL SECURITY;

-- Ensure authenticated users can view table rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'table_rows'
    AND policyname = 'Authenticated users can view all rows'
  ) THEN
    CREATE POLICY "Authenticated users can view all rows"
      ON public.table_rows
      FOR SELECT
      TO authenticated
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Authenticated users can view all tables" ON public.tables IS 
  'All authenticated users can view tables for the Core Data section. Admin-only restrictions are enforced in application logic.';

COMMENT ON POLICY "Authenticated users can view all rows" ON public.table_rows IS 
  'All authenticated users can view table rows. Admin-only restrictions are enforced in application logic.';
