-- Migration: Create interface_groups table and update views table for grouping
-- This enables Airtable-style interface grouping in the sidebar

-- 1. Create interface_groups table
CREATE TABLE IF NOT EXISTS public.interface_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  collapsed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT interface_groups_pkey PRIMARY KEY (id)
);

-- 2. Add group_id and order_index to views table (for interfaces)
ALTER TABLE public.views
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.interface_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_interface_groups_workspace_id ON public.interface_groups(workspace_id);
CREATE INDEX IF NOT EXISTS idx_interface_groups_order_index ON public.interface_groups(order_index);
CREATE INDEX IF NOT EXISTS idx_views_group_id ON public.views(group_id);
CREATE INDEX IF NOT EXISTS idx_views_order_index ON public.views(order_index);

-- 4. Add RLS policies for interface_groups
ALTER TABLE public.interface_groups ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all groups
CREATE POLICY "Allow authenticated users to read interface groups"
  ON public.interface_groups
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert groups
CREATE POLICY "Allow authenticated users to insert interface groups"
  ON public.interface_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update groups
CREATE POLICY "Allow authenticated users to update interface groups"
  ON public.interface_groups
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete groups
CREATE POLICY "Allow authenticated users to delete interface groups"
  ON public.interface_groups
  FOR DELETE
  TO authenticated
  USING (true);

-- 5. Add update trigger for updated_at
CREATE OR REPLACE FUNCTION update_interface_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_interface_groups_updated_at ON public.interface_groups;
CREATE TRIGGER update_interface_groups_updated_at
  BEFORE UPDATE ON public.interface_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_interface_groups_updated_at();

COMMENT ON TABLE public.interface_groups IS 'Groups for organizing interfaces in the sidebar (Airtable-style)';
COMMENT ON COLUMN public.views.group_id IS 'Optional group this interface belongs to';
COMMENT ON COLUMN public.views.order_index IS 'Order within group or uncategorized section';
