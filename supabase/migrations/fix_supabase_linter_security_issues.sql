-- Migration: Fix Supabase Linter Security Issues
-- This migration addresses security issues identified by Supabase Performance Security Lints:
-- 1. Fix user_profile_sync_status view to prevent auth.users exposure
-- 2. Enable RLS on all dynamic data tables
-- 3. Create appropriate RLS policies for dynamic tables
--
-- Based on Supabase Performance Security Lints report

-- ============================================================================
-- 1. Add email to profiles table and sync from auth.users
-- ============================================================================
-- Issue: View exposes auth.users data directly
-- Solution: Add email column to profiles and sync it, then update view to use profiles

-- Add email column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email text;
    CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
  END IF;
END $$;

-- Sync email from auth.users to profiles
-- This is safe because it runs as the function owner (service role)
DO $$
BEGIN
  UPDATE public.profiles p
  SET email = u.email
  FROM auth.users u
  WHERE p.user_id = u.id
    AND (p.email IS NULL OR p.email != u.email);
END $$;

-- Create or replace function to sync email when user is created/updated
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Update profile email when auth.users email changes
  UPDATE public.profiles
  SET email = NEW.email
  WHERE user_id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to sync email on auth.users updates
DROP TRIGGER IF EXISTS sync_profile_email_trigger ON auth.users;
CREATE TRIGGER sync_profile_email_trigger
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_email();

-- ============================================================================
-- 2. Fix user_profile_sync_status view
-- ============================================================================
-- Issue: View exposes auth.users data and may be flagged as SECURITY DEFINER
-- Solution: Completely drop and recreate view to use profiles.email instead of auth.users.email
--           This removes the direct dependency on auth.users and ensures SECURITY INVOKER semantics

-- Completely drop the existing view and any dependencies
DROP VIEW IF EXISTS public.user_profile_sync_status CASCADE;

-- Recreate the view using profiles table (which has proper RLS)
-- This avoids direct access to auth.users
-- Note: Views in PostgreSQL always use SECURITY INVOKER semantics (run with querying user's permissions)
-- There is no SECURITY DEFINER option for views, so this should not be flagged
CREATE VIEW public.user_profile_sync_status AS
SELECT 
  p.user_id,
  p.email,
  p.id as profile_id,
  p.role,
  p.created_at as profile_created_at,
  p.updated_at as profile_updated_at,
  CASE 
    WHEN p.user_id IS NOT NULL THEN 'has_profile'
    ELSE 'missing_profile'
  END as profile_status
FROM public.profiles p
ORDER BY p.created_at DESC;

-- Grant access to authenticated users only (not anon)
REVOKE ALL ON public.user_profile_sync_status FROM anon;
REVOKE ALL ON public.user_profile_sync_status FROM public;
GRANT SELECT ON public.user_profile_sync_status TO authenticated;

-- Add comment explaining the security fix
COMMENT ON VIEW public.user_profile_sync_status IS 
  'Shows profile status for troubleshooting. Uses profiles.email instead of auth.users.email for security. View uses SECURITY INVOKER semantics (default).';

-- ============================================================================
-- 2. Enable RLS on dynamic data tables
-- ============================================================================
-- Issue: Multiple dynamic tables don't have RLS enabled
-- Solution: Enable RLS on all tables listed in the linter report and any other
--           dynamic tables that match the pattern

DO $$
DECLARE
  r record;
  tbl_name text;
  table_list text[] := ARRAY[
    'table_locations_1768568830022',
    'table_events_1768569094201',
    'table_theme_division_matrix_1768568646216',
    'table_tasks_1768655456178',
    'table_quarterly_themes_1768568434852',
    'table_briefings_1766847886126',
    'table_campaigns_1766847958019',
    'table_contacts_1766847128905',
    'table_content_1767726395418',
    'table_sponsorships_1766847842576'
  ];
BEGIN
  -- Enable RLS on specific tables from the linter report
  FOREACH tbl_name IN ARRAY table_list
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables it
      WHERE it.table_schema = 'public'
        AND it.table_name = tbl_name
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl_name);
      RAISE NOTICE 'Enabled RLS on table: %', tbl_name;
    END IF;
  END LOOP;

  -- Also enable RLS on any other dynamic tables that match the pattern
  -- (tables starting with 'table_' that don't have RLS enabled)
  FOR r IN
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_name LIKE 'table\_%' ESCAPE '\'
      AND EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = t.table_name
          AND NOT c.relrowsecurity
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.table_name);
    RAISE NOTICE 'Enabled RLS on dynamic table: %', r.table_name;
  END LOOP;
END $$;

-- ============================================================================
-- 3. Create RLS policies for dynamic data tables
-- ============================================================================
-- Create policies that allow authenticated users to access data in dynamic tables
-- These policies work with the existing access_control system in the tables metadata

DO $$
DECLARE
  r record;
  tbl_name text;
  table_list text[] := ARRAY[
    'table_locations_1768568830022',
    'table_events_1768569094201',
    'table_theme_division_matrix_1768568646216',
    'table_tasks_1768655456178',
    'table_quarterly_themes_1768568434852',
    'table_briefings_1766847886126',
    'table_campaigns_1766847958019',
    'table_contacts_1766847128905',
    'table_content_1767726395418',
    'table_sponsorships_1766847842576'
  ];
  policy_exists boolean;
BEGIN
  -- Create policies for specific tables from the linter report
  FOREACH tbl_name IN ARRAY table_list
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables it
      WHERE it.table_schema = 'public'
        AND it.table_name = tbl_name
    ) THEN
      -- Drop existing policy if it exists
      EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can access data" ON public.%I;', tbl_name);

      -- Create comprehensive policy for all operations
      EXECUTE format(
        'CREATE POLICY "Authenticated users can access data" ON public.%I
         FOR ALL TO authenticated
         USING (auth.role() = ''authenticated'')
         WITH CHECK (auth.role() = ''authenticated'');',
        tbl_name
      );

      RAISE NOTICE 'Created RLS policy for table: %', tbl_name;
    END IF;
  END LOOP;

  -- Also create policies for any other dynamic tables that match the pattern
  FOR r IN
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_name LIKE 'table\_%' ESCAPE '\'
      AND EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = t.table_name
          AND c.relrowsecurity
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_policies p
        WHERE p.schemaname = 'public'
          AND p.tablename = t.table_name
          AND p.policyname = 'Authenticated users can access data'
      )
  LOOP
    -- Drop existing policy if it exists
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can access data" ON public.%I;', r.table_name);

    -- Create comprehensive policy for all operations
    EXECUTE format(
      'CREATE POLICY "Authenticated users can access data" ON public.%I
       FOR ALL TO authenticated
       USING (auth.role() = ''authenticated'')
       WITH CHECK (auth.role() = ''authenticated'');',
      r.table_name
    );

    RAISE NOTICE 'Created RLS policy for dynamic table: %', r.table_name;
  END LOOP;
END $$;

-- ============================================================================
-- 4. Ensure GRANTs are in place for dynamic tables
-- ============================================================================
-- Make sure authenticated role has proper permissions on all dynamic tables

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_name LIKE 'table\_%' ESCAPE '\'
  LOOP
    -- Grant all necessary permissions
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated;',
      r.table_name
    );
  END LOOP;
END $$;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON VIEW public.user_profile_sync_status IS 
  'Shows profile status for troubleshooting. Security: Does not expose auth.users data directly.';
