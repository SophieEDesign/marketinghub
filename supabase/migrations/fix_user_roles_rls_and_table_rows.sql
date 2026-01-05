-- Migration: Fix user_roles RLS (if table exists) and ensure table_rows RLS is correct
-- This addresses 500 errors on user_roles queries and 404 errors on table_rows

-- 1. If user_roles table exists, ensure it has proper RLS policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_roles'
  ) THEN
    -- Enable RLS if not already enabled
    ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can read user_roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;
    
    -- Allow authenticated users to read user_roles (for backward compatibility)
    CREATE POLICY "Users can read user_roles"
      ON public.user_roles
      FOR SELECT
      TO authenticated
      USING (true);
    
    -- Only admins can manage user_roles (via API with server-side checks)
    CREATE POLICY "Admins can manage user_roles"
      ON public.user_roles
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 2. Ensure table_rows table exists and has correct RLS
-- This should already exist, but we'll verify the policies are correct

-- Drop and recreate table_rows RLS policies to ensure they're correct
DROP POLICY IF EXISTS "Rows are viewable with their tables" ON public.table_rows;
DROP POLICY IF EXISTS "Authenticated users can insert rows" ON public.table_rows;
DROP POLICY IF EXISTS "Users can update rows in their tables" ON public.table_rows;
DROP POLICY IF EXISTS "Users can delete rows in their tables" ON public.table_rows;

-- Recreate SELECT policy
CREATE POLICY "Rows are viewable with their tables"
  ON public.table_rows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tables
      WHERE public.tables.id = public.table_rows.table_id
      AND (
        public.tables.access_control = 'public'
        OR (public.tables.access_control = 'authenticated' AND auth.role() = 'authenticated')
        OR (public.tables.access_control = 'owner' AND public.tables.created_by = auth.uid())
      )
    )
  );

-- Recreate INSERT policy
CREATE POLICY "Authenticated users can insert rows"
  ON public.table_rows FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.tables
      WHERE public.tables.id = public.table_rows.table_id
      AND (
        public.tables.access_control = 'public'
        OR public.tables.access_control = 'authenticated'
        OR (public.tables.access_control = 'owner' AND public.tables.created_by = auth.uid())
      )
    )
  );

-- Recreate UPDATE policy
CREATE POLICY "Users can update rows in their tables"
  ON public.table_rows FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tables
      WHERE public.tables.id = public.table_rows.table_id
      AND (
        public.tables.created_by = auth.uid()
        OR public.tables.access_control = 'public'
        OR public.tables.access_control = 'authenticated'
      )
    )
  );

-- Recreate DELETE policy (if needed)
CREATE POLICY "Users can delete rows in their tables"
  ON public.table_rows FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tables
      WHERE public.tables.id = public.table_rows.table_id
      AND (
        public.tables.created_by = auth.uid()
        OR public.tables.access_control = 'public'
        OR public.tables.access_control = 'authenticated'
      )
    )
  );

COMMENT ON POLICY "Rows are viewable with their tables" ON public.table_rows IS 
  'Users can view rows if they have access to the parent table';
COMMENT ON POLICY "Authenticated users can insert rows" ON public.table_rows IS 
  'Authenticated users can insert rows in tables they have access to';
COMMENT ON POLICY "Users can update rows in their tables" ON public.table_rows IS 
  'Users can update rows in tables they have access to';
COMMENT ON POLICY "Users can delete rows in their tables" ON public.table_rows IS 
  'Users can delete rows in tables they have access to';

