-- Migration: Add order_index column to view_sorts table
-- This allows multiple sorts to be ordered properly

-- Add order_index column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'view_sorts' 
    AND column_name = 'order_index'
  ) THEN
    ALTER TABLE public.view_sorts 
    ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0;
    
    -- Create index for better query performance
    CREATE INDEX IF NOT EXISTS idx_view_sorts_order_index 
    ON public.view_sorts(view_id, order_index);
    
    -- Update existing rows to have sequential order_index values
    -- Group by view_id and assign order_index based on creation order
    WITH numbered_sorts AS (
      SELECT 
        id,
        view_id,
        ROW_NUMBER() OVER (PARTITION BY view_id ORDER BY created_at, id) - 1 AS new_order_index
      FROM public.view_sorts
    )
    UPDATE public.view_sorts vs
    SET order_index = ns.new_order_index
    FROM numbered_sorts ns
    WHERE vs.id = ns.id;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN public.view_sorts.order_index IS 'Order index for sorting multiple sort rules within a view';

