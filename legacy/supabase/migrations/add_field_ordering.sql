-- Migration: Add order_index and group to table_fields
-- This enables field ordering and grouping in the Design sidebar

-- Add order_index column (use position as default value)
ALTER TABLE public.table_fields 
ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;

-- Migrate existing position values to order_index
UPDATE public.table_fields 
SET order_index = position 
WHERE order_index = 0 AND position != 0;

-- Add group column (optional string)
ALTER TABLE public.table_fields 
ADD COLUMN IF NOT EXISTS group_name TEXT;

-- Create index for ordering
CREATE INDEX IF NOT EXISTS idx_table_fields_order_index ON public.table_fields(table_id, order_index);

-- Create index for grouping
CREATE INDEX IF NOT EXISTS idx_table_fields_group ON public.table_fields(table_id, group_name);

-- Ensure UNIQUE constraint on (table_id, name) if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'table_fields_table_id_name_key'
    AND conrelid = 'public.table_fields'::regclass
  ) THEN
    ALTER TABLE public.table_fields 
    ADD CONSTRAINT table_fields_table_id_name_key UNIQUE (table_id, name);
  END IF;
END $$;
