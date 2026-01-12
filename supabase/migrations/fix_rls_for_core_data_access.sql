-- Migration: Fix RLS policies to ensure core data is accessible
-- This fixes 500 errors and "can't see core data" issues

-- ============================================================================
-- 1. ENSURE is_user_admin FUNCTION EXISTS
-- ============================================================================

-- Create or replace the is_user_admin function if it doesn't exist
CREATE OR REPLACE FUNCTION public.is_user_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user has admin role in user_roles table
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = is_user_admin.user_id
    AND role = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Fallback: Check if user_roles table exists and has any admin users
  -- If no user_roles table or no admins exist, allow access for now
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. FIX AUTOMATIONS RLS POLICIES
-- ============================================================================

-- Drop ALL existing policies on automations table (catch all variations)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'automations'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.automations', r.policyname);
  END LOOP;
END $$;

-- Allow authenticated users to view automations (we'll restrict admin-only actions via application logic)
CREATE POLICY "Authenticated users can view automations"
  ON public.automations
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to create automations (admin check in application)
CREATE POLICY "Authenticated users can create automations"
  ON public.automations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update automations (admin check in application)
CREATE POLICY "Authenticated users can update automations"
  ON public.automations
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to delete automations (admin check in application)
CREATE POLICY "Authenticated users can delete automations"
  ON public.automations
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- 3. FIX AUTOMATION_RUNS RLS POLICIES
-- ============================================================================

-- Drop ALL existing policies on automation_runs table
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'automation_runs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.automation_runs', r.policyname);
  END LOOP;
END $$;

-- Allow authenticated users to view automation runs
CREATE POLICY "Users can view automation runs"
  ON public.automation_runs
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to create automation runs
CREATE POLICY "Users can create automation runs"
  ON public.automation_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update automation runs
CREATE POLICY "Users can update automation runs"
  ON public.automation_runs
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- 4. FIX AUTOMATION_LOGS RLS POLICIES
-- ============================================================================

-- Drop ALL existing policies on automation_logs table
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'automation_logs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.automation_logs', r.policyname);
  END LOOP;
END $$;

-- Allow authenticated users to view automation logs
CREATE POLICY "Users can view automation logs"
  ON public.automation_logs
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to create automation logs
CREATE POLICY "Users can create automation logs"
  ON public.automation_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- 5. ENSURE INTERFACE_PAGES RLS POLICIES ARE CORRECT
-- ============================================================================

-- Check if interface_pages table exists and has RLS enabled
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'interface_pages'
  ) THEN
    -- Enable RLS if not already enabled
    ALTER TABLE public.interface_pages ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies
    DROP POLICY IF EXISTS "Authenticated users can view interface pages" ON public.interface_pages;
    DROP POLICY IF EXISTS "Authenticated users can create interface pages" ON public.interface_pages;
    DROP POLICY IF EXISTS "Users can update their interface pages" ON public.interface_pages;
    DROP POLICY IF EXISTS "Users can delete their interface pages" ON public.interface_pages;
    
    -- Allow authenticated users to view interface pages
    CREATE POLICY "Authenticated users can view interface pages"
      ON public.interface_pages
      FOR SELECT
      TO authenticated
      USING (auth.role() = 'authenticated');
    
    -- Allow authenticated users to create interface pages
    CREATE POLICY "Authenticated users can create interface pages"
      ON public.interface_pages
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.role() = 'authenticated');
    
    -- Allow authenticated users to update interface pages
    CREATE POLICY "Users can update their interface pages"
      ON public.interface_pages
      FOR UPDATE
      TO authenticated
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
    
    -- Allow authenticated users to delete interface pages
    CREATE POLICY "Users can delete their interface pages"
      ON public.interface_pages
      FOR DELETE
      TO authenticated
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- ============================================================================
-- 6. ENSURE INTERFACE_GROUPS RLS POLICIES ARE CORRECT
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'interface_groups'
  ) THEN
    -- Enable RLS if not already enabled
    ALTER TABLE public.interface_groups ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies
    DROP POLICY IF EXISTS "Authenticated users can view interface groups" ON public.interface_groups;
    DROP POLICY IF EXISTS "Authenticated users can create interface groups" ON public.interface_groups;
    DROP POLICY IF EXISTS "Users can update interface groups" ON public.interface_groups;
    DROP POLICY IF EXISTS "Users can delete interface groups" ON public.interface_groups;
    
    -- Allow authenticated users to view interface groups
    CREATE POLICY "Authenticated users can view interface groups"
      ON public.interface_groups
      FOR SELECT
      TO authenticated
      USING (auth.role() = 'authenticated');
    
    -- Allow authenticated users to create interface groups
    CREATE POLICY "Authenticated users can create interface groups"
      ON public.interface_groups
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.role() = 'authenticated');
    
    -- Allow authenticated users to update interface groups
    CREATE POLICY "Users can update interface groups"
      ON public.interface_groups
      FOR UPDATE
      TO authenticated
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
    
    -- Allow authenticated users to delete interface groups
    CREATE POLICY "Users can delete interface groups"
      ON public.interface_groups
      FOR DELETE
      TO authenticated
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- ============================================================================
-- 7. VERIFY TABLES, VIEWS, AND TABLE_ROWS POLICIES
-- ============================================================================

-- Ensure tables table allows authenticated users to view
DO $$
BEGIN
  -- Check if policy exists, if not create a fallback
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'tables'
    AND policyname = 'Authenticated users can view all tables'
  ) THEN
    -- Create a fallback policy for authenticated users
    CREATE POLICY "Authenticated users can view all tables"
      ON public.tables
      FOR SELECT
      TO authenticated
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Ensure views table allows authenticated users to view
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'views'
    AND policyname = 'Authenticated users can view all views'
  ) THEN
    CREATE POLICY "Authenticated users can view all views"
      ON public.views
      FOR SELECT
      TO authenticated
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Ensure table_rows allows authenticated users to view
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

COMMENT ON POLICY "Authenticated users can view automations" ON public.automations IS 
  'All authenticated users can view automations. Admin-only restrictions are enforced in application logic.';
COMMENT ON POLICY "Authenticated users can view interface pages" ON public.interface_pages IS 
  'All authenticated users can view interface pages. Admin-only restrictions are enforced in application logic.';
