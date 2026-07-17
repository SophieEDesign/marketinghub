-- Migration: Fix infinite recursion in user_roles RLS policies - Final Fix
-- The issue: is_user_admin() queries user_roles, but user_roles policies call is_user_admin(),
-- creating infinite recursion. This migration breaks the cycle.

-- ============================================================================
-- 1. Fix is_user_admin function to properly bypass RLS using SECURITY DEFINER
--    and ensure it only reads from user_roles without triggering policy recursion
-- ============================================================================

-- Use CREATE OR REPLACE since we're keeping the same parameter name (user_id)
-- This avoids dropping the function which would cascade to dependent policies
CREATE OR REPLACE FUNCTION public.is_user_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  user_roles_exists BOOLEAN;
  is_admin_result BOOLEAN := FALSE;
BEGIN
  -- Check profiles table first (new system)
  -- SECURITY DEFINER bypasses RLS, so we can read directly
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = is_user_admin.user_id
    AND profiles.role = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user_roles table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'user_roles'
  ) INTO user_roles_exists;
  
  -- If user_roles table exists, check it
  -- Use SECURITY DEFINER with explicit schema to bypass RLS
  -- SECURITY DEFINER should bypass RLS, but we ensure the SELECT policy on
  -- user_roles doesn't call is_user_admin() to prevent recursion
  IF user_roles_exists THEN
    -- Direct query - SECURITY DEFINER should bypass RLS
    -- The SELECT policy on user_roles allows all reads (USING true) to prevent recursion
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = is_user_admin.user_id
      AND (user_roles.role = 'admin' OR user_roles.role = 'editor')
    ) INTO is_admin_result;
    
    IF is_admin_result THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Ensure function has proper grants
GRANT EXECUTE ON FUNCTION public.is_user_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_admin(UUID) TO anon;

COMMENT ON FUNCTION public.is_user_admin(UUID) IS 
  'Checks if a user is an admin by checking profiles and user_roles tables. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';

-- ============================================================================
-- 2. Fix user_roles RLS policies to prevent recursion
--    The key is: SELECT policy must NOT call is_user_admin()
--    UPDATE/DELETE policies can call is_user_admin() because they won't be
--    triggered during a SELECT operation from is_user_admin()
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_roles'
  ) THEN
    -- Drop ALL existing policies to start fresh
    DROP POLICY IF EXISTS "Users can read user_roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Users can read their own role" ON public.user_roles;
    DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Admins can insert user_roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Admins can update user_roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Admins can delete user_roles" ON public.user_roles;
    
    -- SELECT policy: Simple - allow ALL authenticated users to read ALL user_roles
    -- This is critical: the SELECT policy MUST NOT call is_user_admin() to prevent recursion.
    -- When is_user_admin() queries user_roles (even with SECURITY DEFINER), if the SELECT
    -- policy calls is_user_admin(), we get infinite recursion. By allowing all reads here,
    -- we break the recursion cycle. Security is maintained via INSERT/UPDATE/DELETE policies.
    CREATE POLICY "Users can read all user_roles"
      ON public.user_roles
      FOR SELECT
      TO authenticated
      USING (true);
    
    -- INSERT policy: Only admins can insert (checked via is_user_admin)
    -- This is safe because INSERT policies don't interfere with SELECT operations
    CREATE POLICY "Admins can insert user_roles"
      ON public.user_roles
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_user_admin(auth.uid()));
    
    -- UPDATE policy: Only admins can update (checked via is_user_admin)
    -- This is safe because UPDATE policies don't interfere with SELECT operations
    CREATE POLICY "Admins can update user_roles"
      ON public.user_roles
      FOR UPDATE
      TO authenticated
      USING (public.is_user_admin(auth.uid()))
      WITH CHECK (public.is_user_admin(auth.uid()));
    
    -- DELETE policy: Only admins can delete (checked via is_user_admin)
    -- This is safe because DELETE policies don't interfere with SELECT operations
    CREATE POLICY "Admins can delete user_roles"
      ON public.user_roles
      FOR DELETE
      TO authenticated
      USING (public.is_user_admin(auth.uid()));
  END IF;
END $$;

-- ============================================================================
-- 3. Fix automations table RLS policies
--    These can safely call is_user_admin() because automations doesn't
--    have policies that would cause recursion
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'automations'
  ) THEN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Admins can view all automations" ON public.automations;
    DROP POLICY IF EXISTS "Admins can create automations" ON public.automations;
    DROP POLICY IF EXISTS "Admins can update all automations" ON public.automations;
    DROP POLICY IF EXISTS "Admins can delete all automations" ON public.automations;
    DROP POLICY IF EXISTS "Authenticated users can view automations" ON public.automations;
    
    -- Admins can view all automations
    CREATE POLICY "Admins can view all automations"
      ON public.automations
      FOR SELECT
      TO authenticated
      USING (public.is_user_admin(auth.uid()));
    
    -- Admins can create automations
    CREATE POLICY "Admins can create automations"
      ON public.automations
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_user_admin(auth.uid()));
    
    -- Admins can update all automations
    CREATE POLICY "Admins can update all automations"
      ON public.automations
      FOR UPDATE
      TO authenticated
      USING (public.is_user_admin(auth.uid()))
      WITH CHECK (public.is_user_admin(auth.uid()));
    
    -- Admins can delete all automations
    CREATE POLICY "Admins can delete all automations"
      ON public.automations
      FOR DELETE
      TO authenticated
      USING (public.is_user_admin(auth.uid()));
  END IF;
END $$;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON POLICY "Users can read all user_roles" ON public.user_roles IS 
  'All authenticated users can read all user_roles. This prevents recursion because SELECT policy does not call is_user_admin().';

COMMENT ON POLICY "Admins can insert user_roles" ON public.user_roles IS 
  'Only admins can insert user_roles. This is safe because INSERT policies do not interfere with SELECT operations.';

COMMENT ON POLICY "Admins can update user_roles" ON public.user_roles IS 
  'Only admins can update user_roles. This is safe because UPDATE policies do not interfere with SELECT operations.';

COMMENT ON POLICY "Admins can delete user_roles" ON public.user_roles IS 
  'Only admins can delete user_roles. This is safe because DELETE policies do not interfere with SELECT operations.';

COMMENT ON POLICY "Admins can view all automations" ON public.automations IS 
  'Admins can view all automations using the is_user_admin function';

COMMENT ON POLICY "Admins can create automations" ON public.automations IS 
  'Admins can create automations using the is_user_admin function';

COMMENT ON POLICY "Admins can update all automations" ON public.automations IS 
  'Admins can update all automations using the is_user_admin function';

COMMENT ON POLICY "Admins can delete all automations" ON public.automations IS 
  'Admins can delete all automations using the is_user_admin function';
