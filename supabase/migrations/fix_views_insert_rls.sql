-- Migration: Add INSERT RLS policies for views table
-- Currently, views can only be selected/deleted but not created due to missing INSERT policies
-- This allows users to create interface pages, views for tables they have access to, and admins to create any view
--
-- Also fixes the views.type CHECK constraint to include 'gallery' and 'timeline' view types
-- that are used by gallery and timeline page types
--
-- Page Types Covered:
-- - list → creates view with type='grid' (covered by Policy 2)
-- - gallery → creates view with type='gallery' (covered by Policy 2)
-- - kanban → creates view with type='kanban' (covered by Policy 2)
-- - calendar → creates view with type='calendar' (covered by Policy 2)
-- - timeline → creates view with type='timeline' (covered by Policy 2)
-- - record_review → creates view with type='grid' (covered by Policy 2)
-- - form → may create view with type='form' (covered by Policy 2)
-- - dashboard/overview/content → use interface_pages table, not views (covered by Policy 1 if they create views)

-- ============================================================================
-- 1. Fix views.type CHECK constraint to include gallery and timeline
-- ============================================================================

-- Drop existing constraint if it exists
ALTER TABLE public.views 
  DROP CONSTRAINT IF EXISTS views_type_check;

-- Add new constraint with gallery and timeline included
ALTER TABLE public.views 
  ADD CONSTRAINT views_type_check 
  CHECK (type = ANY (ARRAY['grid'::text, 'kanban'::text, 'calendar'::text, 'form'::text, 'interface'::text, 'gallery'::text, 'timeline'::text]));

-- ============================================================================
-- 2. INSERT Policies
-- ============================================================================

-- Drop existing INSERT policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can create interface pages" ON public.views;
DROP POLICY IF EXISTS "Users can create views via table access" ON public.views;
DROP POLICY IF EXISTS "Admins can create any view" ON public.views;

-- Policy 1: Users can create interface pages (type = 'interface' or page_type is set)
-- Interface pages should be creatable by any authenticated user
CREATE POLICY "Users can create interface pages"
  ON public.views
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (
      type = 'interface'
      OR page_type IS NOT NULL
    )
  );

-- Policy 2: Users can create views if they have access to the parent table
-- This allows users to create views for tables they own or have access to
-- This covers all data view types: grid, kanban, calendar, gallery, timeline, form
CREATE POLICY "Users can create views via table access"
  ON public.views
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.role() = 'authenticated'
    AND table_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.tables
      WHERE tables.id = views.table_id
      AND (
        tables.created_by = auth.uid()
        OR tables.access_control = 'public'
        OR tables.access_control = 'authenticated'
        OR (tables.access_control = 'owner' AND tables.created_by = auth.uid())
      )
    )
  );

-- Policy 3: Admins can create any view
-- This allows admins to create views regardless of table access
CREATE POLICY "Admins can create any view"
  ON public.views
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

COMMENT ON POLICY "Users can create interface pages" ON public.views IS 
  'Authenticated users can create interface pages (type = interface or page_type is set)';

COMMENT ON POLICY "Users can create views via table access" ON public.views IS 
  'Users can create views for tables they own or have access to based on access_control settings';

COMMENT ON POLICY "Admins can create any view" ON public.views IS 
  'Admins can create any view regardless of table access';

-- ============================================================================
-- UPDATE Policies (for completeness)
-- ============================================================================

-- Drop existing UPDATE policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can update interface pages" ON public.views;
DROP POLICY IF EXISTS "Users can update views via table access" ON public.views;
DROP POLICY IF EXISTS "Admins can update any view" ON public.views;

-- Policy 1: Users can update interface pages they own
CREATE POLICY "Users can update interface pages"
  ON public.views
  FOR UPDATE
  TO authenticated
  USING (
    (type = 'interface' OR page_type IS NOT NULL)
    AND owner_id = auth.uid()
  )
  WITH CHECK (
    (type = 'interface' OR page_type IS NOT NULL)
    AND owner_id = auth.uid()
  );

-- Policy 2: Users can update views if they have access to the parent table
CREATE POLICY "Users can update views via table access"
  ON public.views
  FOR UPDATE
  TO authenticated
  USING (
    table_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.tables
      WHERE tables.id = views.table_id
      AND (
        tables.created_by = auth.uid()
        OR tables.access_control = 'public'
        OR tables.access_control = 'authenticated'
        OR (tables.access_control = 'owner' AND tables.created_by = auth.uid())
      )
    )
  )
  WITH CHECK (
    table_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.tables
      WHERE tables.id = views.table_id
      AND (
        tables.created_by = auth.uid()
        OR tables.access_control = 'public'
        OR tables.access_control = 'authenticated'
        OR (tables.access_control = 'owner' AND tables.created_by = auth.uid())
      )
    )
  );

-- Policy 3: Admins can update any view
CREATE POLICY "Admins can update any view"
  ON public.views
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

COMMENT ON POLICY "Users can update interface pages" ON public.views IS 
  'Users can update interface pages they own';

COMMENT ON POLICY "Users can update views via table access" ON public.views IS 
  'Users can update views for tables they own or have access to';

COMMENT ON POLICY "Admins can update any view" ON public.views IS 
  'Admins can update any view regardless of ownership';
