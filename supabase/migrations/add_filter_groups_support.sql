-- Migration: Add filter groups support with AND/OR logic
-- This allows grouping filters and defining AND/OR logic between conditions within groups

-- Create view_filter_groups table
CREATE TABLE IF NOT EXISTS public.view_filter_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  view_id uuid NOT NULL,
  condition_type text NOT NULL DEFAULT 'AND' CHECK (condition_type IN ('AND', 'OR')),
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT view_filter_groups_pkey PRIMARY KEY (id),
  CONSTRAINT view_filter_groups_view_id_fkey FOREIGN KEY (view_id) REFERENCES public.views(id) ON DELETE CASCADE
);

-- Add filter_group_id to view_filters table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'view_filters' 
    AND column_name = 'filter_group_id'
  ) THEN
    ALTER TABLE public.view_filters
      ADD COLUMN filter_group_id uuid,
      ADD CONSTRAINT view_filters_filter_group_id_fkey 
        FOREIGN KEY (filter_group_id) REFERENCES public.view_filter_groups(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add order_index to view_filters for ordering within groups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'view_filters' 
    AND column_name = 'order_index'
  ) THEN
    ALTER TABLE public.view_filters
      ADD COLUMN order_index integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_view_filter_groups_view_id ON public.view_filter_groups(view_id);
CREATE INDEX IF NOT EXISTS idx_view_filters_filter_group_id ON public.view_filters(filter_group_id) WHERE filter_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_view_filters_order_index ON public.view_filters(order_index);

-- Enable RLS on view_filter_groups
ALTER TABLE public.view_filter_groups ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for view_filter_groups (similar to view_filters)
-- Policy: Users can view filter groups for views they have access to
CREATE POLICY "Users can view filter groups for accessible views"
  ON public.view_filter_groups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.views v
      WHERE v.id = view_filter_groups.view_id
      AND (
        v.access_level = 'public'
        OR v.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
          AND ur.role IN (SELECT unnest(v.allowed_roles))
        )
      )
    )
  );

-- Policy: Users can insert filter groups for views they can edit
CREATE POLICY "Users can insert filter groups for editable views"
  ON public.view_filter_groups
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.views v
      WHERE v.id = view_filter_groups.view_id
      AND (
        v.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin', 'editor')
        )
      )
    )
  );

-- Policy: Users can update filter groups for views they can edit
CREATE POLICY "Users can update filter groups for editable views"
  ON public.view_filter_groups
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.views v
      WHERE v.id = view_filter_groups.view_id
      AND (
        v.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin', 'editor')
        )
      )
    )
  );

-- Policy: Users can delete filter groups for views they can edit
CREATE POLICY "Users can delete filter groups for editable views"
  ON public.view_filter_groups
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.views v
      WHERE v.id = view_filter_groups.view_id
      AND (
        v.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin', 'editor')
        )
      )
    )
  );

COMMENT ON TABLE public.view_filter_groups IS 'Groups of filters with AND/OR logic between conditions';
COMMENT ON COLUMN public.view_filter_groups.condition_type IS 'AND or OR - how conditions within this group are combined';
COMMENT ON COLUMN public.view_filters.filter_group_id IS 'Optional reference to filter group. NULL means filter is not in a group (backward compatibility)';
