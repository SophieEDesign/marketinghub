-- Migration: Add RLS policies for view_blocks table
-- This migration adds SELECT, INSERT, UPDATE, and DELETE policies for view_blocks
-- to allow authenticated users to manage blocks for views and interface_pages they have access to

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

DROP POLICY IF EXISTS "Users can view blocks for accessible views" ON public.view_blocks;
DROP POLICY IF EXISTS "Users can view blocks for accessible pages" ON public.view_blocks;
DROP POLICY IF EXISTS "Admins can view all blocks" ON public.view_blocks;
DROP POLICY IF EXISTS "Users can create blocks for accessible views" ON public.view_blocks;
DROP POLICY IF EXISTS "Users can create blocks for accessible pages" ON public.view_blocks;
DROP POLICY IF EXISTS "Admins can create blocks" ON public.view_blocks;
DROP POLICY IF EXISTS "Users can update blocks for accessible views" ON public.view_blocks;
DROP POLICY IF EXISTS "Users can update blocks for accessible pages" ON public.view_blocks;
DROP POLICY IF EXISTS "Admins can update all blocks" ON public.view_blocks;
DROP POLICY IF EXISTS "Users can delete blocks for accessible views" ON public.view_blocks;
DROP POLICY IF EXISTS "Users can delete blocks for accessible pages" ON public.view_blocks;
DROP POLICY IF EXISTS "Admins can delete all blocks" ON public.view_blocks;

-- ============================================================================
-- SELECT Policies
-- ============================================================================

-- Admins can view all blocks
CREATE POLICY "Admins can view all blocks"
  ON public.view_blocks FOR SELECT
  TO authenticated
  USING (public.is_user_admin(auth.uid()));

-- Users can view blocks for views they have access to
CREATE POLICY "Users can view blocks for accessible views"
  ON public.view_blocks FOR SELECT
  TO authenticated
  USING (
    view_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.views
      WHERE views.id = view_blocks.view_id
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

-- Users can view blocks for interface_pages they have access to
CREATE POLICY "Users can view blocks for accessible pages"
  ON public.view_blocks FOR SELECT
  TO authenticated
  USING (
    page_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.interface_pages
      WHERE interface_pages.id = view_blocks.page_id
      AND (
        -- Non-admin-only pages are accessible to all authenticated users
        NOT interface_pages.is_admin_only
        -- Admin-only pages require admin role
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role = 'admin'
        )
      )
    )
  );

-- ============================================================================
-- INSERT Policies
-- ============================================================================

-- Admins can create blocks
CREATE POLICY "Admins can create blocks"
  ON public.view_blocks FOR INSERT
  TO authenticated
  WITH CHECK (public.is_user_admin(auth.uid()));

-- Users can create blocks for views they have access to
CREATE POLICY "Users can create blocks for accessible views"
  ON public.view_blocks FOR INSERT
  TO authenticated
  WITH CHECK (
    view_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.views
      WHERE views.id = view_blocks.view_id
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

-- Users can create blocks for interface_pages they have access to
CREATE POLICY "Users can create blocks for accessible pages"
  ON public.view_blocks FOR INSERT
  TO authenticated
  WITH CHECK (
    page_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.interface_pages
      WHERE interface_pages.id = view_blocks.page_id
      AND (
        -- Non-admin-only pages are accessible to all authenticated users
        NOT interface_pages.is_admin_only
        -- Admin-only pages require admin role
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role = 'admin'
        )
      )
    )
  );

-- ============================================================================
-- UPDATE Policies
-- ============================================================================

-- Admins can update all blocks
CREATE POLICY "Admins can update all blocks"
  ON public.view_blocks FOR UPDATE
  TO authenticated
  USING (public.is_user_admin(auth.uid()))
  WITH CHECK (public.is_user_admin(auth.uid()));

-- Users can update blocks for views they have access to
CREATE POLICY "Users can update blocks for accessible views"
  ON public.view_blocks FOR UPDATE
  TO authenticated
  USING (
    view_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.views
      WHERE views.id = view_blocks.view_id
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
      WHERE views.id = view_blocks.view_id
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

-- Users can update blocks for interface_pages they have access to
CREATE POLICY "Users can update blocks for accessible pages"
  ON public.view_blocks FOR UPDATE
  TO authenticated
  USING (
    page_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.interface_pages
      WHERE interface_pages.id = view_blocks.page_id
      AND (
        -- Non-admin-only pages are accessible to all authenticated users
        NOT interface_pages.is_admin_only
        -- Admin-only pages require admin role
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role = 'admin'
        )
      )
    )
  )
  WITH CHECK (
    page_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.interface_pages
      WHERE interface_pages.id = view_blocks.page_id
      AND (
        -- Non-admin-only pages are accessible to all authenticated users
        NOT interface_pages.is_admin_only
        -- Admin-only pages require admin role
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role = 'admin'
        )
      )
    )
  );

-- ============================================================================
-- DELETE Policies
-- ============================================================================

-- Admins can delete all blocks
CREATE POLICY "Admins can delete all blocks"
  ON public.view_blocks FOR DELETE
  TO authenticated
  USING (public.is_user_admin(auth.uid()));

-- Users can delete blocks for views they have access to
CREATE POLICY "Users can delete blocks for accessible views"
  ON public.view_blocks FOR DELETE
  TO authenticated
  USING (
    view_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.views
      WHERE views.id = view_blocks.view_id
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

-- Users can delete blocks for interface_pages they have access to
CREATE POLICY "Users can delete blocks for accessible pages"
  ON public.view_blocks FOR DELETE
  TO authenticated
  USING (
    page_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.interface_pages
      WHERE interface_pages.id = view_blocks.page_id
      AND (
        -- Non-admin-only pages are accessible to all authenticated users
        NOT interface_pages.is_admin_only
        -- Admin-only pages require admin role
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role = 'admin'
        )
      )
    )
  );

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON POLICY "Admins can view all blocks" ON public.view_blocks IS 
  'Allows users with admin role to view all blocks regardless of view/page access';

COMMENT ON POLICY "Users can view blocks for accessible views" ON public.view_blocks IS 
  'Allows users to view blocks for views they have access to based on table access or interface page type';

COMMENT ON POLICY "Users can view blocks for accessible pages" ON public.view_blocks IS 
  'Allows users to view blocks for interface_pages they have access to (non-admin-only pages or admin role)';

COMMENT ON POLICY "Admins can create blocks" ON public.view_blocks IS 
  'Allows users with admin role to create blocks';

COMMENT ON POLICY "Users can create blocks for accessible views" ON public.view_blocks IS 
  'Allows users to create blocks for views they have access to';

COMMENT ON POLICY "Users can create blocks for accessible pages" ON public.view_blocks IS 
  'Allows users to create blocks for interface_pages they have access to';

COMMENT ON POLICY "Admins can update all blocks" ON public.view_blocks IS 
  'Allows users with admin role to update any block';

COMMENT ON POLICY "Users can update blocks for accessible views" ON public.view_blocks IS 
  'Allows users to update blocks for views they have access to';

COMMENT ON POLICY "Users can update blocks for accessible pages" ON public.view_blocks IS 
  'Allows users to update blocks for interface_pages they have access to';

COMMENT ON POLICY "Admins can delete all blocks" ON public.view_blocks IS 
  'Allows users with admin role to delete any block';

COMMENT ON POLICY "Users can delete blocks for accessible views" ON public.view_blocks IS 
  'Allows users to delete blocks for views they have access to';

COMMENT ON POLICY "Users can delete blocks for accessible pages" ON public.view_blocks IS 
  'Allows users to delete blocks for interface_pages they have access to';

