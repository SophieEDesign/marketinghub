-- Migration: Ensure all interface pages belong to a group
-- Creates a system "Ungrouped" group for pages without group_id
-- This group will be hidden in Browse mode but visible in Edit mode

-- 1. Create "Ungrouped" group if it doesn't exist
DO $$
DECLARE
  ungrouped_group_id uuid;
BEGIN
  -- Check if "Ungrouped" group exists
  SELECT id INTO ungrouped_group_id
  FROM public.interface_groups
  WHERE name = 'Ungrouped'
  LIMIT 1;

  -- Create if it doesn't exist
  IF ungrouped_group_id IS NULL THEN
    INSERT INTO public.interface_groups (name, order_index, collapsed)
    VALUES ('Ungrouped', 9999, false)
    RETURNING id INTO ungrouped_group_id;
  END IF;

  -- Assign all interface pages without group_id to "Ungrouped"
  UPDATE public.views
  SET group_id = ungrouped_group_id
  WHERE type = 'interface' 
    AND group_id IS NULL;
END $$;

-- 2. Add a flag to mark system groups (like "Ungrouped")
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'interface_groups' 
    AND column_name = 'is_system'
  ) THEN
    ALTER TABLE public.interface_groups
      ADD COLUMN is_system boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 3. Mark "Ungrouped" as a system group
UPDATE public.interface_groups
SET is_system = true
WHERE name = 'Ungrouped';

-- 4. Ensure group_id is NOT NULL for interface pages going forward
-- We'll use a default group_id constraint via trigger
CREATE OR REPLACE FUNCTION assign_default_group()
RETURNS TRIGGER AS $$
DECLARE
  ungrouped_id uuid;
BEGIN
  -- Only for interface pages
  IF NEW.type = 'interface' AND NEW.group_id IS NULL THEN
    -- Get or create "Ungrouped" group
    SELECT id INTO ungrouped_id
    FROM public.interface_groups
    WHERE name = 'Ungrouped' AND is_system = true
    LIMIT 1;

    IF ungrouped_id IS NULL THEN
      INSERT INTO public.interface_groups (name, order_index, collapsed, is_system)
      VALUES ('Ungrouped', 9999, false, true)
      RETURNING id INTO ungrouped_id;
    END IF;

    NEW.group_id := ungrouped_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS assign_default_group_trigger ON public.views;

-- Create trigger
CREATE TRIGGER assign_default_group_trigger
  BEFORE INSERT ON public.views
  FOR EACH ROW
  EXECUTE FUNCTION assign_default_group();

COMMENT ON COLUMN public.interface_groups.is_system IS 'System groups (like "Ungrouped") are hidden in Browse mode';

