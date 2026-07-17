-- Migration: Add clarity for Admin Tables + Interface Pages Model
-- This migration adds documentation and enforces the hierarchy:
-- Tables (admin only) -> Views (internal plumbing) -> Pages (user-facing) -> Interfaces (containers)

-- 1. Add comments to clarify internal-only tables
-- These tables are backing data for Pages, not user-facing entities

COMMENT ON TABLE public.views IS 'Internal backing for interface_pages. Not user-facing. Views are technical configurations that back Pages.';
COMMENT ON TABLE public.view_blocks IS 'Internal backing for dashboard/overview page blocks. Not user-facing.';
COMMENT ON TABLE public.view_filters IS 'Internal backing for page filters. Not user-facing.';
COMMENT ON TABLE public.view_fields IS 'Internal backing for page field visibility. Not user-facing.';
COMMENT ON TABLE public.view_sorts IS 'Internal backing for page sorting. Not user-facing.';

-- 2. Ensure all interface_pages have a group_id before adding constraint
-- First, ensure there's an "Ungrouped" group
DO $$
DECLARE
  ungrouped_id UUID;
BEGIN
  -- Check if ungrouped group exists
  SELECT id INTO ungrouped_id
  FROM interface_groups
  WHERE name = 'Ungrouped'
  LIMIT 1;

  -- Create ungrouped group if it doesn't exist
  IF ungrouped_id IS NULL THEN
    INSERT INTO interface_groups (id, name, order_index, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Ungrouped', 0, NOW(), NOW())
    RETURNING id INTO ungrouped_id;
  END IF;

  -- Update any pages without a group_id to use the ungrouped group
  UPDATE interface_pages
  SET group_id = ungrouped_id
  WHERE group_id IS NULL;
END $$;

-- 3. Add constraint to ensure group_id is required
-- Note: This will fail if there are still NULL values, but we've handled that above
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'interface_pages_group_required'
  ) THEN
    ALTER TABLE public.interface_pages
    ADD CONSTRAINT interface_pages_group_required
    CHECK (group_id IS NOT NULL);
  END IF;
END $$;

-- 4. Add comment to interface_pages table clarifying its role
COMMENT ON TABLE public.interface_pages IS 'User-facing Pages that belong to Interfaces (interface_groups). These are the primary screens users interact with. Pages reference SQL views (via source_view) for data, but views themselves are internal-only.';
COMMENT ON COLUMN public.interface_pages.group_id IS 'Required reference to interface_groups. Pages must belong to an Interface.';

-- 5. Add comment to interface_groups clarifying its role
COMMENT ON TABLE public.interface_groups IS 'Interfaces are containers for Pages. They provide access control and grouping. Interfaces themselves never render content directly - only their Pages do.';

-- 6. Add comment to tables table clarifying admin-only access
COMMENT ON TABLE public.tables IS 'Admin-only: Raw data tables. These are power-user/admin tools for managing data structure. Not visible to regular users.';

