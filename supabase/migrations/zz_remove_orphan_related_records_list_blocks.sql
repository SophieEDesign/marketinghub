-- Cleanup migration: remove orphan/unrenderable blocks
-- The `related_records_list` block type was found in code as dead/orphaned and has been removed.
-- If any rows exist in page_blocks referencing this type, delete them to avoid "Unknown block type" UI.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'page_blocks'
  ) THEN
    DELETE FROM public.page_blocks
    WHERE type = 'related_records_list';
  END IF;
END
$$;

