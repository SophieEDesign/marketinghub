-- Migration: Add SELECT RLS policies for views table
-- This migration adds proper SELECT policies for views to fix 406 errors
-- Views should be accessible based on table access or admin status

-- ============================================================================
-- Ensure is_user_admin function exists (if not already created)
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
$$;

-- Ensure function has proper grants
GRANT EXECUTE ON FUNCTION public.is_user_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_admin(UUID) TO anon;

-- ============================================================================
-- Drop existing SELECT policies if they exist (to recreate them)
-- ============================================================================

DROP POLICY IF EXISTS "Views are viewable with their tables" ON public.views;
DROP POLICY IF EXISTS "Admins can view all views" ON public.views;
DROP POLICY IF EXISTS "Users can view interface pages" ON public.views;
DROP POLICY IF EXISTS "Users can view views via table access" ON public.views;

-- ============================================================================
-- Admin Policies (must come first for proper evaluation)
-- ============================================================================

-- Admins can view all views
-- Uses is_user_admin function to check both profiles and user_roles tables
CREATE POLICY "Admins can view all views"
  ON public.views FOR SELECT
  TO authenticated
  USING (public.is_user_admin(auth.uid()));

-- ============================================================================
-- Regular User Policies (for non-admin users)
-- ============================================================================

-- Users can view interface pages (type = 'interface' or page_type is set)
-- Interface pages should be viewable by authenticated users
CREATE POLICY "Users can view interface pages"
  ON public.views FOR SELECT
  TO authenticated
  USING (
    type = 'interface' 
    OR page_type IS NOT NULL
  );

-- Users can view views if they have access to the parent table
-- This covers traditional views (grid, kanban, calendar, etc.)
CREATE POLICY "Users can view views via table access"
  ON public.views FOR SELECT
  TO authenticated
  USING (
    table_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.tables
      WHERE tables.id = views.table_id
      AND (
        -- Admin can access via admin policy above, so this is for regular users
        tables.access_control = 'public'
        OR (tables.access_control = 'authenticated' AND auth.role() = 'authenticated')
        OR (tables.access_control = 'owner' AND tables.created_by = auth.uid())
        -- Also allow if user created the table (regardless of access_control)
        OR tables.created_by = auth.uid()
      )
    )
  );

-- Legacy policy name for backward compatibility
-- This matches the original schema policy name and covers all cases
CREATE POLICY "Views are viewable with their tables"
  ON public.views FOR SELECT
  TO authenticated
  USING (
    -- Interface pages
    type = 'interface' 
    OR page_type IS NOT NULL
    -- Or views with table access
    OR (
      table_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.tables
        WHERE tables.id = views.table_id
        AND (
          tables.access_control = 'public'
          OR (tables.access_control = 'authenticated' AND auth.role() = 'authenticated')
          OR (tables.access_control = 'owner' AND tables.created_by = auth.uid())
          OR tables.created_by = auth.uid()
        )
      )
    )
  );

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON POLICY "Admins can view all views" ON public.views IS 
  'Allows users with admin role to view all views regardless of table access';

COMMENT ON POLICY "Users can view interface pages" ON public.views IS 
  'Allows authenticated users to view interface pages (type = interface or page_type is set)';

COMMENT ON POLICY "Users can view views via table access" ON public.views IS 
  'Allows users to view views for tables they have access to based on access_control settings';

COMMENT ON POLICY "Views are viewable with their tables" ON public.views IS 
  'Legacy policy for backward compatibility - allows viewing views based on table access or interface pages';

