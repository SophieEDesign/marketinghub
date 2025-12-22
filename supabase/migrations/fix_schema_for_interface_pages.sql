-- Migration: Fix schema for interface pages and correct table structures
-- This migration fixes the schema to match the implementation

-- 1. Fix views table
-- Add 'interface' to type CHECK constraint, make table_id nullable, add missing columns

-- Drop existing constraint if it exists
ALTER TABLE public.views 
  DROP CONSTRAINT IF EXISTS views_type_check;

-- Add new constraint with 'interface' included
ALTER TABLE public.views 
  ADD CONSTRAINT views_type_check 
  CHECK (type = ANY (ARRAY['grid'::text, 'kanban'::text, 'calendar'::text, 'form'::text, 'interface'::text]));

-- Make table_id nullable (interface pages don't belong to a table)
ALTER TABLE public.views 
  ALTER COLUMN table_id DROP NOT NULL;

-- Add missing columns
ALTER TABLE public.views 
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Fix allowed_roles syntax if it exists
DO $$
BEGIN
  -- Check if column exists and has wrong type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'views' 
    AND column_name = 'allowed_roles'
  ) THEN
    -- Try to alter to text[] if it's not already
    BEGIN
      ALTER TABLE public.views 
        ALTER COLUMN allowed_roles TYPE text[] USING ARRAY[allowed_roles::text];
    EXCEPTION WHEN OTHERS THEN
      -- If it's already text[] or can't convert, just ensure it exists
      NULL;
    END;
  ELSE
    -- Add column if it doesn't exist
    ALTER TABLE public.views 
      ADD COLUMN allowed_roles text[];
  END IF;
END $$;

-- Add update trigger for updated_at
CREATE OR REPLACE FUNCTION update_views_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_views_updated_at ON public.views;
CREATE TRIGGER update_views_updated_at
  BEFORE UPDATE ON public.views
  FOR EACH ROW
  EXECUTE FUNCTION update_views_updated_at();

-- 2. Fix view_blocks table
-- Replace position jsonb with separate columns and add missing columns

-- Drop position column if it exists
ALTER TABLE public.view_blocks 
  DROP COLUMN IF EXISTS position;

-- Add separate position columns
ALTER TABLE public.view_blocks 
  ADD COLUMN IF NOT EXISTS position_x integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS position_y integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS width integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS height integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Migrate data from position jsonb if it exists and has data
DO $$
DECLARE
  block_record RECORD;
BEGIN
  -- Check if old position column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'view_blocks' 
    AND column_name = 'position'
  ) THEN
    -- Migrate existing data (if any)
    FOR block_record IN 
      SELECT id, position::jsonb as pos 
      FROM public.view_blocks 
      WHERE position IS NOT NULL
    LOOP
      UPDATE public.view_blocks
      SET 
        position_x = COALESCE((block_record.pos->>'x')::integer, 0),
        position_y = COALESCE((block_record.pos->>'y')::integer, 0),
        width = COALESCE((block_record.pos->>'w')::integer, 4),
        height = COALESCE((block_record.pos->>'h')::integer, 4)
      WHERE id = block_record.id;
    END LOOP;
  END IF;
END $$;

-- Replace settings/visibility with config if needed
DO $$
BEGIN
  -- If settings column exists, migrate to config
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'view_blocks' 
    AND column_name = 'settings'
  ) THEN
    -- Add config if it doesn't exist
    ALTER TABLE public.view_blocks 
      ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb;
    
    -- Migrate settings to config
    UPDATE public.view_blocks
    SET config = COALESCE(settings, '{}'::jsonb)
    WHERE config = '{}'::jsonb AND settings IS NOT NULL;
    
    -- Drop settings column
    ALTER TABLE public.view_blocks 
      DROP COLUMN IF EXISTS settings;
  END IF;
  
  -- Drop visibility column if it exists (we use config for everything)
  ALTER TABLE public.view_blocks 
    DROP COLUMN IF EXISTS visibility;
END $$;

-- Add update trigger for updated_at
CREATE OR REPLACE FUNCTION update_view_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_view_blocks_updated_at ON public.view_blocks;
CREATE TRIGGER update_view_blocks_updated_at
  BEFORE UPDATE ON public.view_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_view_blocks_updated_at();

-- 3. Fix tables table
-- Add missing supabase_table column and other columns

ALTER TABLE public.tables 
  ADD COLUMN IF NOT EXISTS supabase_table text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Set default supabase_table for existing rows (generate from name if null)
UPDATE public.tables 
SET supabase_table = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '_', 'g'))
WHERE supabase_table IS NULL;

-- Make supabase_table NOT NULL after setting defaults
ALTER TABLE public.tables 
  ALTER COLUMN supabase_table SET NOT NULL;

-- Add update trigger for updated_at
CREATE OR REPLACE FUNCTION update_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tables_updated_at ON public.tables;
CREATE TRIGGER update_tables_updated_at
  BEFORE UPDATE ON public.tables
  FOR EACH ROW
  EXECUTE FUNCTION update_tables_updated_at();

-- 4. Fix view_fields table
-- Add visible column if using visible (check what the code expects)

ALTER TABLE public.view_fields 
  ADD COLUMN IF NOT EXISTS visible boolean DEFAULT true;

-- If hidden column exists, sync with visible
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'view_fields' 
    AND column_name = 'hidden'
  ) THEN
    -- Sync visible with NOT hidden
    UPDATE public.view_fields
    SET visible = NOT COALESCE(hidden, false)
    WHERE visible IS NULL OR visible = true;
  END IF;
END $$;

-- 5. Create workspaces table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.workspaces (
  id text PRIMARY KEY DEFAULT 'default',
  name text NOT NULL DEFAULT 'Marketing Hub',
  icon text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Insert default workspace if it doesn't exist
INSERT INTO public.workspaces (id, name, icon)
VALUES ('default', 'Marketing Hub', '📊')
ON CONFLICT (id) DO NOTHING;

-- Add update trigger for workspaces updated_at
CREATE OR REPLACE FUNCTION update_workspaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_workspaces_updated_at();

-- Enable RLS on workspaces if not already enabled
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for workspaces
DROP POLICY IF EXISTS "Allow authenticated users to read workspace" ON public.workspaces;
CREATE POLICY "Allow authenticated users to read workspace"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to update workspace" ON public.workspaces;
CREATE POLICY "Allow authenticated users to update workspace"
  ON public.workspaces FOR UPDATE
  TO authenticated
  USING (true);
