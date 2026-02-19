-- Migration: Add view_blocks.page_id column if missing
-- Fixes: "column view_blocks.page_id does not exist" when saving layout
-- Safe to run multiple times (idempotent)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'view_blocks'
      AND column_name = 'page_id'
  ) THEN
    ALTER TABLE public.view_blocks
      ADD COLUMN page_id uuid REFERENCES public.interface_pages(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_view_blocks_page_id 
      ON public.view_blocks(page_id) WHERE page_id IS NOT NULL;
    RAISE NOTICE 'Added view_blocks.page_id column';
  ELSE
    RAISE NOTICE 'view_blocks.page_id already exists, skipping';
  END IF;
END $$;
