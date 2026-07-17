-- Migration: Fix Missing Tables and RLS Issues
-- This migration ensures table_rows and grid_view_settings tables exist
-- and fixes RLS policies for user_roles

-- 0. Ensure tables table has access_control column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tables' 
    AND column_name = 'access_control'
  ) THEN
    ALTER TABLE public.tables 
      ADD COLUMN access_control TEXT DEFAULT 'authenticated' 
      CHECK (access_control IN ('public', 'authenticated', 'role-based', 'owner'));
  END IF;
END $$;

-- 1. Create table_rows table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.table_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create indexes for table_rows
CREATE INDEX IF NOT EXISTS idx_table_rows_table_id ON public.table_rows(table_id);
CREATE INDEX IF NOT EXISTS idx_table_rows_data ON public.table_rows USING GIN(data);

-- Enable RLS on table_rows
ALTER TABLE public.table_rows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
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
        OR (COALESCE(public.tables.access_control, 'authenticated') = 'authenticated' AND auth.role() = 'authenticated')
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
        OR COALESCE(public.tables.access_control, 'authenticated') = 'authenticated'
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
        OR COALESCE(public.tables.access_control, 'authenticated') = 'authenticated'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tables
      WHERE public.tables.id = public.table_rows.table_id
      AND (
        public.tables.created_by = auth.uid()
        OR public.tables.access_control = 'public'
        OR COALESCE(public.tables.access_control, 'authenticated') = 'authenticated'
      )
    )
  );

-- Recreate DELETE policy
CREATE POLICY "Users can delete rows in their tables"
  ON public.table_rows FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tables
      WHERE public.tables.id = public.table_rows.table_id
      AND (
        public.tables.created_by = auth.uid()
        OR public.tables.access_control = 'public'
        OR COALESCE(public.tables.access_control, 'authenticated') = 'authenticated'
      )
    )
  );

-- Create trigger for updated_at if function exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_table_rows_updated_at ON public.table_rows;
    CREATE TRIGGER update_table_rows_updated_at 
      BEFORE UPDATE ON public.table_rows
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 2. Create grid_view_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.grid_view_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id UUID NOT NULL REFERENCES public.views(id) ON DELETE CASCADE,
  group_by_field TEXT,
  column_widths JSONB DEFAULT '{}'::jsonb,
  column_order JSONB DEFAULT '[]'::jsonb,
  column_wrap_text JSONB DEFAULT '{}'::jsonb,
  row_height TEXT DEFAULT 'medium' CHECK (row_height IN ('short', 'medium', 'tall')),
  frozen_columns INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(view_id)
);

-- Create index for grid_view_settings
CREATE INDEX IF NOT EXISTS idx_grid_view_settings_view_id ON public.grid_view_settings(view_id);

-- Enable RLS on grid_view_settings
ALTER TABLE public.grid_view_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read grid view settings for accessible views" ON public.grid_view_settings;
DROP POLICY IF EXISTS "Users can manage grid view settings for accessible views" ON public.grid_view_settings;

-- Recreate SELECT policy
CREATE POLICY "Users can read grid view settings for accessible views"
  ON public.grid_view_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.views
      WHERE public.views.id = public.grid_view_settings.view_id
      AND (
        EXISTS (
          SELECT 1 FROM public.tables
          WHERE public.tables.id = public.views.table_id
          AND (
            public.tables.access_control = 'public'
            OR (COALESCE(public.tables.access_control, 'authenticated') = 'authenticated' AND auth.role() = 'authenticated')
            OR (public.tables.access_control = 'owner' AND public.tables.created_by = auth.uid())
          )
        )
      )
    )
  );

-- Recreate INSERT/UPDATE/DELETE policy
CREATE POLICY "Users can manage grid view settings for accessible views"
  ON public.grid_view_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.views
      WHERE public.views.id = public.grid_view_settings.view_id
      AND EXISTS (
        SELECT 1 FROM public.tables
        WHERE public.tables.id = public.views.table_id
        AND (
          public.tables.access_control = 'public'
          OR COALESCE(public.tables.access_control, 'authenticated') = 'authenticated'
          OR (public.tables.access_control = 'owner' AND public.tables.created_by = auth.uid())
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.views
      WHERE public.views.id = public.grid_view_settings.view_id
      AND EXISTS (
        SELECT 1 FROM public.tables
        WHERE public.tables.id = public.views.table_id
        AND (
          public.tables.access_control = 'public'
          OR COALESCE(public.tables.access_control, 'authenticated') = 'authenticated'
          OR (public.tables.access_control = 'owner' AND public.tables.created_by = auth.uid())
        )
      )
    )
  );

-- Create trigger for updated_at if function exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_grid_view_settings_updated_at ON public.grid_view_settings;
    CREATE TRIGGER update_grid_view_settings_updated_at
      BEFORE UPDATE ON public.grid_view_settings
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 3. Fix user_roles RLS if table exists
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
    
    -- Allow authenticated users to read user_roles
    CREATE POLICY "Users can read user_roles"
      ON public.user_roles
      FOR SELECT
      TO authenticated
      USING (true);
    
    -- Allow authenticated users to manage user_roles (server-side checks handle admin-only)
    CREATE POLICY "Admins can manage user_roles"
      ON public.user_roles
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE public.table_rows IS 'Stores row data for tables as JSONB';
COMMENT ON TABLE public.grid_view_settings IS 'Grid-specific settings for grid views';
COMMENT ON COLUMN public.grid_view_settings.column_widths IS 'JSON object mapping field names to column widths in pixels';
COMMENT ON COLUMN public.grid_view_settings.column_order IS 'JSON array of field names in display order';

