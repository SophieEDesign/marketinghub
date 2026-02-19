-- ============================================================================
-- Migration: Fix view_fields RLS for initialize-fields API
-- ============================================================================
-- Issue: When creating a new view (e.g. Timeline), the initialize-fields API
-- fails with "Failed to add fields to view" because view_fields has RLS enabled
-- but no INSERT policy. This leaves new views with empty view_fields, causing
-- Timeline/Calendar/etc. to not load properly.
--
-- Fix: Add SELECT, INSERT, UPDATE, DELETE policies for view_fields, matching
-- the pattern used for view_sorts (admins + users with view/table access).
-- ============================================================================

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can view fields for accessible views" ON public.view_fields;
DROP POLICY IF EXISTS "Admins can view all view fields" ON public.view_fields;
DROP POLICY IF EXISTS "Users can create fields for accessible views" ON public.view_fields;
DROP POLICY IF EXISTS "Admins can create view fields" ON public.view_fields;
DROP POLICY IF EXISTS "Users can update fields for accessible views" ON public.view_fields;
DROP POLICY IF EXISTS "Admins can update all view fields" ON public.view_fields;
DROP POLICY IF EXISTS "Users can delete fields for accessible views" ON public.view_fields;
DROP POLICY IF EXISTS "Admins can delete all view fields" ON public.view_fields;

-- ============================================================================
-- SELECT Policies
-- ============================================================================

CREATE POLICY "Admins can view all view fields"
  ON public.view_fields FOR SELECT
  TO authenticated
  USING (public.is_user_admin(auth.uid()));

CREATE POLICY "Users can view fields for accessible views"
  ON public.view_fields FOR SELECT
  TO authenticated
  USING (
    view_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.views
      WHERE views.id = view_fields.view_id
      AND (
        views.type = 'interface'
        OR views.page_type IS NOT NULL
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

CREATE POLICY "Admins can create view fields"
  ON public.view_fields FOR INSERT
  TO authenticated
  WITH CHECK (public.is_user_admin(auth.uid()));

CREATE POLICY "Users can create fields for accessible views"
  ON public.view_fields FOR INSERT
  TO authenticated
  WITH CHECK (
    view_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.views
      WHERE views.id = view_fields.view_id
      AND (
        views.type = 'interface'
        OR views.page_type IS NOT NULL
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

CREATE POLICY "Admins can update all view fields"
  ON public.view_fields FOR UPDATE
  TO authenticated
  USING (public.is_user_admin(auth.uid()))
  WITH CHECK (public.is_user_admin(auth.uid()));

CREATE POLICY "Users can update fields for accessible views"
  ON public.view_fields FOR UPDATE
  TO authenticated
  USING (
    view_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.views
      WHERE views.id = view_fields.view_id
      AND (
        views.type = 'interface'
        OR views.page_type IS NOT NULL
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
      WHERE views.id = view_fields.view_id
      AND (
        views.type = 'interface'
        OR views.page_type IS NOT NULL
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

CREATE POLICY "Admins can delete all view fields"
  ON public.view_fields FOR DELETE
  TO authenticated
  USING (public.is_user_admin(auth.uid()));

CREATE POLICY "Users can delete fields for accessible views"
  ON public.view_fields FOR DELETE
  TO authenticated
  USING (
    view_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.views
      WHERE views.id = view_fields.view_id
      AND (
        views.type = 'interface'
        OR views.page_type IS NOT NULL
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

COMMENT ON POLICY "Admins can create view fields" ON public.view_fields IS
  'Allows admins to insert view_fields. Fixes initialize-fields API for new Timeline/Calendar/etc. views.';
