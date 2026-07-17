-- Migration: Ensure Core Data (tables) are visible in sidebar
-- This fixes the issue where tables don't appear in the Core Data section

-- ============================================================================
-- 1. ENSURE TABLES TABLE EXISTS AND HAS RLS ENABLED
-- ============================================================================

-- Enable RLS on tables if not already enabled
ALTER TABLE IF EXISTS public.tables ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. DROP EXISTING POLICIES TO AVOID CONFLICTS
-- ============================================================================

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

-- ============================================================================
-- 3. CREATE COMPREHENSIVE RLS POLICIES FOR TABLES
-- ============================================================================

-- Policy: Authenticated users can view all tables
CREATE POLICY "Authenticated users can view all tables"
  ON public.tables
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Policy: Authenticated users can create tables
CREATE POLICY "Authenticated users can create tables"
  ON public.tables
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Authenticated users can update tables
CREATE POLICY "Authenticated users can update tables"
  ON public.tables
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Authenticated users can delete tables (admin-only in app logic)
CREATE POLICY "Authenticated users can delete tables"
  ON public.tables
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- 4. ENSURE TABLE_ROWS HAS PROPER RLS POLICIES
-- ============================================================================

-- Enable RLS on table_rows if not already enabled
ALTER TABLE IF EXISTS public.table_rows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on table_rows
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

-- Policy: Authenticated users can view all rows
CREATE POLICY "Authenticated users can view all rows"
  ON public.table_rows
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Policy: Authenticated users can insert rows
CREATE POLICY "Authenticated users can insert rows"
  ON public.table_rows
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Authenticated users can update rows
CREATE POLICY "Authenticated users can update rows"
  ON public.table_rows
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Authenticated users can delete rows
CREATE POLICY "Authenticated users can delete rows"
  ON public.table_rows
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- 5. VERIFY POLICIES WERE CREATED
-- ============================================================================

DO $$
DECLARE
  table_policy_count INTEGER;
  table_row_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' 
    AND tablename = 'tables'
    AND policyname = 'Authenticated users can view all tables';
  
  SELECT COUNT(*) INTO table_row_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' 
    AND tablename = 'table_rows'
    AND policyname = 'Authenticated users can view all rows';
  
  IF table_policy_count = 0 THEN
    RAISE WARNING 'Policy for tables SELECT was not created';
  END IF;
  
  IF table_row_policy_count = 0 THEN
    RAISE WARNING 'Policy for table_rows SELECT was not created';
  END IF;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Authenticated users can view all tables" ON public.tables IS 
  'All authenticated users can view tables for the Core Data section. Admin-only restrictions are enforced in application logic.';

COMMENT ON POLICY "Authenticated users can view all rows" ON public.table_rows IS 
  'All authenticated users can view table rows. Admin-only restrictions are enforced in application logic.';
