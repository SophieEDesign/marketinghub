-- ============================================================================
-- Migration: Fix view_fields RLS for Core Data (Kanban, Grid, Calendar, etc.)
-- ============================================================================
-- Issue: The 20250219000003 migration added restrictive policies that require
-- views.type = 'interface' OR views.page_type IS NOT NULL OR complex
-- tables.access_control checks. This excludes:
--   - Kanban/Grid/Calendar views (type = 'kanban'/'grid'/'calendar', not 'interface')
--   - Tables with access_control = 'role-based' (not in policy)
--   - Tables with NULL access_control
-- Result: view_fields SELECT returns empty → "Error loading table", Kanban
-- flickering, AbortError flood from retries.
--
-- Fix: Replace with simple permissive policies matching view_filter_groups fix
-- (20250224000001). View must exist; app enforces access at API level.
-- ============================================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view fields for accessible views" ON public.view_fields;
DROP POLICY IF EXISTS "Admins can view all view fields" ON public.view_fields;
DROP POLICY IF EXISTS "Users can create fields for accessible views" ON public.view_fields;
DROP POLICY IF EXISTS "Admins can create view fields" ON public.view_fields;
DROP POLICY IF EXISTS "Users can update fields for accessible views" ON public.view_fields;
DROP POLICY IF EXISTS "Admins can update all view fields" ON public.view_fields;
DROP POLICY IF EXISTS "Users can delete fields for accessible views" ON public.view_fields;
DROP POLICY IF EXISTS "Admins can delete all view fields" ON public.view_fields;

-- Simple policies: view must exist (no type/access_control checks that exclude Core Data)
CREATE POLICY "Authenticated users can select view_fields"
  ON public.view_fields FOR SELECT
  TO authenticated
  USING (
    view_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.views v WHERE v.id = view_fields.view_id)
  );

CREATE POLICY "Authenticated users can insert view_fields"
  ON public.view_fields FOR INSERT
  TO authenticated
  WITH CHECK (
    view_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.views v WHERE v.id = view_fields.view_id)
  );

CREATE POLICY "Authenticated users can update view_fields"
  ON public.view_fields FOR UPDATE
  TO authenticated
  USING (
    view_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.views v WHERE v.id = view_fields.view_id)
  )
  WITH CHECK (
    view_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.views v WHERE v.id = view_fields.view_id)
  );

CREATE POLICY "Authenticated users can delete view_fields"
  ON public.view_fields FOR DELETE
  TO authenticated
  USING (
    view_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.views v WHERE v.id = view_fields.view_id)
  );

COMMENT ON POLICY "Authenticated users can select view_fields" ON public.view_fields IS
  'Allows authenticated users to read view_fields when view exists. Fixes Kanban/Grid/Calendar loading blocked by restrictive type/access_control checks.';
