-- Migration: Add DELETE RLS policies for views table
-- Currently, views can only be selected but not deleted due to missing DELETE policies
-- This allows users to delete interface pages, views for tables they have access to, and admins to delete any view

-- Drop existing DELETE policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can delete interface pages" ON public.views;
DROP POLICY IF EXISTS "Users can delete views via table access" ON public.views;
DROP POLICY IF EXISTS "Admins can delete any view" ON public.views;

-- Policy 1: Users can delete interface pages (type = 'interface')
-- Interface pages should be deletable by any authenticated user since they create their own pages
-- This is the most permissive policy for interface pages
CREATE POLICY "Users can delete interface pages"
  ON public.views
  FOR DELETE
  TO authenticated
  USING (
    type = 'interface'
  );

-- Policy 2: Users can delete views if they have access to the parent table
-- This allows users to delete views for tables they own or have access to
-- This covers traditional views (grid, kanban, calendar, etc.)
CREATE POLICY "Users can delete views via table access"
  ON public.views
  FOR DELETE
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
      )
    )
  );

-- Policy 3: Admins can delete any view
-- This allows admins to manage all views regardless of ownership
CREATE POLICY "Admins can delete any view"
  ON public.views
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

COMMENT ON POLICY "Users can delete interface pages" ON public.views IS 
  'Authenticated users can delete interface pages (type = interface)';

COMMENT ON POLICY "Users can delete views via table access" ON public.views IS 
  'Users can delete views for tables they own or have access to';

COMMENT ON POLICY "Admins can delete any view" ON public.views IS 
  'Admins can delete any view regardless of ownership';

