-- Migration: Fix view_blocks to support interface_pages
-- This allows blocks to be linked to interface_pages (for dashboard/overview pages)
-- in addition to views (for traditional views)

-- 1. Ensure is_system column exists in interface_groups
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

-- 2. Make view_blocks.view_id nullable (it can reference views OR interface_pages)
-- First, drop the foreign key constraint
ALTER TABLE public.view_blocks
  DROP CONSTRAINT IF EXISTS view_blocks_view_id_fkey;

-- Make view_id nullable
ALTER TABLE public.view_blocks
  ALTER COLUMN view_id DROP NOT NULL;

-- 3. Add page_id column to reference interface_pages
ALTER TABLE public.view_blocks
  ADD COLUMN IF NOT EXISTS page_id uuid REFERENCES public.interface_pages(id) ON DELETE CASCADE;

-- 4. Add check constraint to ensure exactly one of view_id or page_id is set
ALTER TABLE public.view_blocks
  DROP CONSTRAINT IF EXISTS view_blocks_reference_check;

ALTER TABLE public.view_blocks
  ADD CONSTRAINT view_blocks_reference_check
  CHECK (
    (view_id IS NOT NULL AND page_id IS NULL) OR
    (view_id IS NULL AND page_id IS NOT NULL)
  );

-- 5. Re-add foreign key constraint for view_id (now nullable)
ALTER TABLE public.view_blocks
  ADD CONSTRAINT view_blocks_view_id_fkey
  FOREIGN KEY (view_id) REFERENCES public.views(id) ON DELETE CASCADE;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_view_blocks_page_id ON public.view_blocks(page_id) WHERE page_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_view_blocks_view_id ON public.view_blocks(view_id) WHERE view_id IS NOT NULL;

-- 7. Update comments
COMMENT ON COLUMN public.view_blocks.view_id IS 'References views.id for traditional view blocks. NULL for interface page blocks.';
COMMENT ON COLUMN public.view_blocks.page_id IS 'References interface_pages.id for dashboard/overview page blocks. NULL for traditional view blocks.';

