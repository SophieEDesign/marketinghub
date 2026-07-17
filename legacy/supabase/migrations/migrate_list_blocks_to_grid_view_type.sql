-- Convert list blocks to grid blocks with view_type='list'
-- This migration amalgamates List into the Block View Type system
-- so it behaves as a first-class view option, similar to Airtable.

-- Convert list blocks to grid blocks with view_type='list'
UPDATE public.view_blocks
SET 
  type = 'grid',
  config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{view_type}',
    '"list"'
  )
WHERE type = 'list';

-- Add a comment explaining the migration
COMMENT ON COLUMN public.view_blocks.type IS 'Block type. Note: list blocks have been migrated to grid blocks with view_type=''list''.';
