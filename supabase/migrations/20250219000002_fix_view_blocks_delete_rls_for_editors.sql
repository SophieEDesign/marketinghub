-- ============================================================================
-- Migration: Fix view_blocks DELETE RLS for "Failed to delete block" errors
-- ============================================================================
-- Issue: Non-admin users with editor role (user_roles) could not delete blocks
-- on admin-only interface_pages. The "accessible pages" policy only checked
-- profiles.role = 'admin', while is_user_admin() also grants editor role.
--
-- Fix: Use is_user_admin(auth.uid()) for admin-only page access, consistent
-- with the UPDATE policy fix (20250219000001) and "Admins can delete all blocks".
-- ============================================================================

DROP POLICY IF EXISTS "Users can delete blocks for accessible pages" ON public.view_blocks;

CREATE POLICY "Users can delete blocks for accessible pages"
  ON public.view_blocks FOR DELETE
  TO authenticated
  USING (
    page_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.interface_pages
      WHERE interface_pages.id = view_blocks.page_id
      AND (
        -- Non-admin-only pages: any authenticated user can delete
        NOT interface_pages.is_admin_only
        -- Admin-only pages: require admin OR editor (via is_user_admin)
        OR public.is_user_admin(auth.uid())
      )
    )
  );

COMMENT ON POLICY "Users can delete blocks for accessible pages" ON public.view_blocks IS
  'Allows users to delete blocks for interface_pages they have access to. Uses is_user_admin for admin-only pages (includes editor role from user_roles).';
