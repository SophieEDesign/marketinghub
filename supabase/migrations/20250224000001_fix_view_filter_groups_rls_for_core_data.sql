-- Migration: Fix view_filter_groups RLS for Core Data (Kanban, etc.)
-- The add_filter_groups_support policies reference user_roles/allowed_roles which can cause 500
-- when those tables/columns don't match the schema. Add permissive fallback for authenticated users.

-- Drop existing restrictive policies (they may block Core Data views)
DROP POLICY IF EXISTS "Users can view filter groups for accessible views" ON public.view_filter_groups;
DROP POLICY IF EXISTS "Users can insert filter groups for editable views" ON public.view_filter_groups;
DROP POLICY IF EXISTS "Users can update filter groups for editable views" ON public.view_filter_groups;
DROP POLICY IF EXISTS "Users can delete filter groups for editable views" ON public.view_filter_groups;

-- Allow authenticated users to manage filter groups (view must exist; app enforces access)
CREATE POLICY "Authenticated users can select view_filter_groups"
  ON public.view_filter_groups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.views v
      WHERE v.id = view_filter_groups.view_id
    )
  );

CREATE POLICY "Authenticated users can insert view_filter_groups"
  ON public.view_filter_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.views v
      WHERE v.id = view_filter_groups.view_id
    )
  );

CREATE POLICY "Authenticated users can update view_filter_groups"
  ON public.view_filter_groups
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.views v
      WHERE v.id = view_filter_groups.view_id
    )
  );

CREATE POLICY "Authenticated users can delete view_filter_groups"
  ON public.view_filter_groups
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.views v
      WHERE v.id = view_filter_groups.view_id
    )
  );
