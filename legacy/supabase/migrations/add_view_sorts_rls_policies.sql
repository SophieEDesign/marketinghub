-- Migration: Add RLS policies for view_sorts table
-- This migration adds SELECT, INSERT, UPDATE, and DELETE policies for view_sorts
-- to allow authenticated users to manage sorts for views they have access to

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
-- Drop existing policies if they exist (idempotent)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view sorts for accessible views" ON public.view_sorts;
DROP POLICY IF EXISTS "Admins can view all sorts" ON public.view_sorts;
DROP POLICY IF EXISTS "Users can create sorts for accessible views" ON public.view_sorts;
DROP POLICY IF EXISTS "Admins can create sorts" ON public.view_sorts;
DROP POLICY IF EXISTS "Users can update sorts for accessible views" ON public.view_sorts;
DROP POLICY IF EXISTS "Admins can update all sorts" ON public.view_sorts;
DROP POLICY IF EXISTS "Users can delete sorts for accessible views" ON public.view_sorts;
DROP POLICY IF EXISTS "Admins can delete all sorts" ON public.view_sorts;

-- ============================================================================
-- SELECT Policies
-- ============================================================================

-- Admins can view all sorts
CREATE POLICY "Admins can view all sorts"
  ON public.view_sorts FOR SELECT
  TO authenticated
  USING (public.is_user_admin(auth.uid()));

-- Users can view sorts for views they have access to
CREATE POLICY "Users can view sorts for accessible views"
  ON public.view_sorts FOR SELECT
  TO authenticated
  USING (
    view_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.views
      WHERE views.id = view_sorts.view_id
      AND (
        -- Interface pages are accessible to authenticated users
        views.type = 'interface' 
        OR views.page_type IS NOT NULL
        -- Or views with table access
        OR (
          views.table_id IS NOT NULL
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
      )
    )
  );

-- ============================================================================
-- INSERT Policies
-- ============================================================================

-- Admins can create sorts
CREATE POLICY "Admins can create sorts"
  ON public.view_sorts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_user_admin(auth.uid()));

-- Users can create sorts for views they have access to
CREATE POLICY "Users can create sorts for accessible views"
  ON public.view_sorts FOR INSERT
  TO authenticated
  WITH CHECK (
    view_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.views
      WHERE views.id = view_sorts.view_id
      AND (
        -- Interface pages are accessible to authenticated users
        views.type = 'interface' 
        OR views.page_type IS NOT NULL
        -- Or views with table access
        OR (
          views.table_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.tables
            WHERE tables.id = views.table_id
            AND (
              tables.access_control = 'public'
              OR tables.access_control = 'authenticated'
              OR (tables.access_control = 'owner' AND tables.created_by = auth.uid())
              OR tables.created_by = auth.uid()
            )
          )
        )
      )
    )
  );

-- ============================================================================
-- UPDATE Policies
-- ============================================================================

-- Admins can update all sorts
CREATE POLICY "Admins can update all sorts"
  ON public.view_sorts FOR UPDATE
  TO authenticated
  USING (public.is_user_admin(auth.uid()))
  WITH CHECK (public.is_user_admin(auth.uid()));

-- Users can update sorts for views they have access to
CREATE POLICY "Users can update sorts for accessible views"
  ON public.view_sorts FOR UPDATE
  TO authenticated
  USING (
    view_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.views
      WHERE views.id = view_sorts.view_id
      AND (
        -- Interface pages are accessible to authenticated users
        views.type = 'interface' 
        OR views.page_type IS NOT NULL
        -- Or views with table access
        OR (
          views.table_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.tables
            WHERE tables.id = views.table_id
            AND (
              tables.access_control = 'public'
              OR tables.access_control = 'authenticated'
              OR (tables.access_control = 'owner' AND tables.created_by = auth.uid())
              OR tables.created_by = auth.uid()
            )
          )
        )
      )
    )
  )
  WITH CHECK (
    view_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.views
      WHERE views.id = view_sorts.view_id
      AND (
        -- Interface pages are accessible to authenticated users
        views.type = 'interface' 
        OR views.page_type IS NOT NULL
        -- Or views with table access
        OR (
          views.table_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.tables
            WHERE tables.id = views.table_id
            AND (
              tables.access_control = 'public'
              OR tables.access_control = 'authenticated'
              OR (tables.access_control = 'owner' AND tables.created_by = auth.uid())
              OR tables.created_by = auth.uid()
            )
          )
        )
      )
    )
  );

-- ============================================================================
-- DELETE Policies
-- ============================================================================

-- Admins can delete all sorts
CREATE POLICY "Admins can delete all sorts"
  ON public.view_sorts FOR DELETE
  TO authenticated
  USING (public.is_user_admin(auth.uid()));

-- Users can delete sorts for views they have access to
CREATE POLICY "Users can delete sorts for accessible views"
  ON public.view_sorts FOR DELETE
  TO authenticated
  USING (
    view_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.views
      WHERE views.id = view_sorts.view_id
      AND (
        -- Interface pages are accessible to authenticated users
        views.type = 'interface' 
        OR views.page_type IS NOT NULL
        -- Or views with table access
        OR (
          views.table_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.tables
            WHERE tables.id = views.table_id
            AND (
              tables.access_control = 'public'
              OR tables.access_control = 'authenticated'
              OR (tables.access_control = 'owner' AND tables.created_by = auth.uid())
              OR tables.created_by = auth.uid()
            )
          )
        )
      )
    )
  );

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON POLICY "Admins can view all sorts" ON public.view_sorts IS 
  'Allows users with admin role to view all sorts regardless of view access';

COMMENT ON POLICY "Users can view sorts for accessible views" ON public.view_sorts IS 
  'Allows users to view sorts for views they have access to based on table access or interface page type';

COMMENT ON POLICY "Admins can create sorts" ON public.view_sorts IS 
  'Allows users with admin role to create sorts';

COMMENT ON POLICY "Users can create sorts for accessible views" ON public.view_sorts IS 
  'Allows users to create sorts for views they have access to';

COMMENT ON POLICY "Admins can update all sorts" ON public.view_sorts IS 
  'Allows users with admin role to update any sort';

COMMENT ON POLICY "Users can update sorts for accessible views" ON public.view_sorts IS 
  'Allows users to update sorts for views they have access to';

COMMENT ON POLICY "Admins can delete all sorts" ON public.view_sorts IS 
  'Allows users with admin role to delete any sort';

COMMENT ON POLICY "Users can delete sorts for accessible views" ON public.view_sorts IS 
  'Allows users to delete sorts for views they have access to';
