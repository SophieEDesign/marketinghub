-- Migration: Add Admin Policies for Tables
-- This migration adds RLS policies that allow admins to access all tables
-- regardless of access_control settings, which is needed for the Settings Data tab
-- 
-- The migration uses a helper function (is_user_admin) that safely checks both
-- the profiles table (new system) and user_roles table (legacy system), handling
-- cases where either table might not exist.

-- ============================================================================
-- Helper function to check if user is admin (supports both profiles and user_roles)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_user_admin(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_roles_exists BOOLEAN;
BEGIN
  -- Check profiles table (new system)
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
  IF user_roles_exists THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Drop existing policies if they exist (to recreate them)
-- ============================================================================

DROP POLICY IF EXISTS "Public tables are viewable by everyone" ON public.tables;
DROP POLICY IF EXISTS "Authenticated users can view authenticated tables" ON public.tables;
DROP POLICY IF EXISTS "Users can view their own tables" ON public.tables;
DROP POLICY IF EXISTS "Authenticated users can create tables" ON public.tables;
DROP POLICY IF EXISTS "Users can update their own tables" ON public.tables;
DROP POLICY IF EXISTS "Admins can view all tables" ON public.tables;
DROP POLICY IF EXISTS "Admins can create tables" ON public.tables;
DROP POLICY IF EXISTS "Admins can update all tables" ON public.tables;
DROP POLICY IF EXISTS "Admins can delete all tables" ON public.tables;

-- ============================================================================
-- Admin Policies (must come first for proper evaluation)
-- ============================================================================

-- Admins can view all tables
-- Uses helper function to check both profiles and user_roles tables
CREATE POLICY "Admins can view all tables"
  ON public.tables FOR SELECT
  USING (public.is_user_admin(auth.uid()));

-- Admins can create tables
-- Uses helper function to check both profiles and user_roles tables
CREATE POLICY "Admins can create tables"
  ON public.tables FOR INSERT
  WITH CHECK (public.is_user_admin(auth.uid()));

-- Admins can update all tables
-- Uses helper function to check both profiles and user_roles tables
CREATE POLICY "Admins can update all tables"
  ON public.tables FOR UPDATE
  USING (public.is_user_admin(auth.uid()))
  WITH CHECK (public.is_user_admin(auth.uid()));

-- Admins can delete all tables
-- Uses helper function to check both profiles and user_roles tables
CREATE POLICY "Admins can delete all tables"
  ON public.tables FOR DELETE
  USING (public.is_user_admin(auth.uid()));

-- ============================================================================
-- Regular User Policies (for non-admin users)
-- ============================================================================

-- Public tables are viewable by everyone
CREATE POLICY "Public tables are viewable by everyone"
  ON public.tables FOR SELECT
  USING (access_control = 'public');

-- Authenticated users can view authenticated tables
CREATE POLICY "Authenticated users can view authenticated tables"
  ON public.tables FOR SELECT
  USING (access_control = 'authenticated' AND auth.role() = 'authenticated');

-- Users can view their own tables
CREATE POLICY "Users can view their own tables"
  ON public.tables FOR SELECT
  USING (access_control = 'owner' AND created_by = auth.uid());

-- Authenticated users can create tables
CREATE POLICY "Authenticated users can create tables"
  ON public.tables FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Users can update their own tables
CREATE POLICY "Users can update their own tables"
  ON public.tables FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Users can delete their own tables
CREATE POLICY "Users can delete their own tables"
  ON public.tables FOR DELETE
  USING (created_by = auth.uid());

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON POLICY "Admins can view all tables" ON public.tables IS 
  'Allows users with admin role in profiles table to view all tables regardless of access_control';

COMMENT ON POLICY "Admins can create tables" ON public.tables IS 
  'Allows users with admin role in profiles table to create tables';

COMMENT ON POLICY "Admins can update all tables" ON public.tables IS 
  'Allows users with admin role in profiles table to update any table';

COMMENT ON POLICY "Admins can delete all tables" ON public.tables IS 
  'Allows users with admin role in profiles table to delete any table';

