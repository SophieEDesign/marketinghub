-- ============================================================================
-- Migration: Fix view_blocks UPDATE RLS for "Failed to save layout" errors
-- ============================================================================
-- Issue: Non-admin users with editor role (user_roles) could not update blocks
-- on admin-only interface_pages. The "accessible pages" policy only checked
-- profiles.role = 'admin', while is_user_admin() also grants editor role.
-- 
-- Fix: Use is_user_admin(auth.uid()) for admin-only page access, consistent
-- with "Admins can update all blocks" and other view_blocks policies.
-- ============================================================================

-- Drop and recreate "Users can update blocks for accessible pages" policy
DROP POLICY IF EXISTS "Users can update blocks for accessible pages" ON public.view_blocks;

CREATE POLICY "Users can update blocks for accessible pages"
  ON public.view_blocks FOR UPDATE
  TO authenticated
  USING (
    page_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.interface_pages
      WHERE interface_pages.id = view_blocks.page_id
      AND (
        -- Non-admin-only pages: any authenticated user can update
        NOT interface_pages.is_admin_only
        -- Admin-only pages: require admin OR editor (via is_user_admin)
        OR public.is_user_admin(auth.uid())
      )
    )
  )
  WITH CHECK (
    page_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.interface_pages
      WHERE interface_pages.id = view_blocks.page_id
      AND (
        NOT interface_pages.is_admin_only
        OR public.is_user_admin(auth.uid())
      )
    )
  );

COMMENT ON POLICY "Users can update blocks for accessible pages" ON public.view_blocks IS 
  'Allows users to update blocks for interface_pages they have access to. Uses is_user_admin for admin-only pages (includes editor role from user_roles).';
