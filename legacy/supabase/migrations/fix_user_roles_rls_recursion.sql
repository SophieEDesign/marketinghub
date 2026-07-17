-- Migration: Fix infinite recursion in user_roles RLS policies
-- This fixes the existing is_user_admin function to properly bypass RLS
-- and fixes automations table policies

-- ============================================================================
-- 1. Fix existing is_user_admin function to properly bypass RLS
-- The function needs to use SECURITY DEFINER with proper search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_user_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  user_roles_exists BOOLEAN;
BEGIN
  -- Check profiles table first (new system)
  -- This bypasses RLS because of SECURITY DEFINER
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
  
  -- Check user_roles table (legacy system) - only if table exists
  -- SECURITY DEFINER with proper ownership should bypass RLS
  -- But to be extra safe, we'll check directly without triggering policy evaluation
  IF user_roles_exists THEN
    -- Direct check - SECURITY DEFINER should bypass RLS
    IF EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = is_user_admin.user_id
      AND (user_roles.role = 'admin' OR user_roles.role = 'editor')
    ) THEN
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
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_roles'
  ) THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can read user_roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Users can read their own role" ON public.user_roles;
    DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Admins can insert user_roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Admins can update user_roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Admins can delete user_roles" ON public.user_roles;
    
    -- Create a simple policy that doesn't cause recursion
    -- Allow users to read their own role only (no admin check to prevent recursion)
    CREATE POLICY "Users can read their own role"
      ON public.user_roles
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
    
    -- Allow admins to insert/update/delete user_roles (NOT SELECT to prevent recursion)
    -- SELECT is handled by the policy above
    CREATE POLICY "Admins can insert user_roles"
      ON public.user_roles
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_user_admin(auth.uid()));
    
    CREATE POLICY "Admins can update user_roles"
      ON public.user_roles
      FOR UPDATE
      TO authenticated
      USING (public.is_user_admin(auth.uid()))
      WITH CHECK (public.is_user_admin(auth.uid()));
    
    CREATE POLICY "Admins can delete user_roles"
      ON public.user_roles
      FOR DELETE
      TO authenticated
      USING (public.is_user_admin(auth.uid()));
  END IF;
END $$;

-- ============================================================================
-- 3. Add RLS policies for automations table
-- ============================================================================

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

-- ============================================================================
-- 4. Note: Admin policies for tables already use is_user_admin function
-- No changes needed here as they're already correct
-- ============================================================================

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON POLICY "Users can read their own role" ON public.user_roles IS 
  'Users can only read their own role entry to prevent recursion';

COMMENT ON POLICY "Admins can insert user_roles" ON public.user_roles IS 
  'Admins can insert user_roles using the is_user_admin function to prevent recursion';

COMMENT ON POLICY "Admins can update user_roles" ON public.user_roles IS 
  'Admins can update user_roles using the is_user_admin function to prevent recursion';

COMMENT ON POLICY "Admins can delete user_roles" ON public.user_roles IS 
  'Admins can delete user_roles using the is_user_admin function to prevent recursion';

COMMENT ON POLICY "Admins can view all automations" ON public.automations IS 
  'Admins can view all automations using the is_user_admin function';

COMMENT ON POLICY "Admins can create automations" ON public.automations IS 
  'Admins can create automations using the is_user_admin function';

COMMENT ON POLICY "Admins can update all automations" ON public.automations IS 
  'Admins can update all automations using the is_user_admin function';

COMMENT ON POLICY "Admins can delete all automations" ON public.automations IS 
  'Admins can delete all automations using the is_user_admin function';

