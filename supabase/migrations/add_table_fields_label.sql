-- Add human-friendly field label to table_fields.
-- `name` remains the internal/DB-safe identifier (snake_case), while `label` preserves the original title users typed.

ALTER TABLE public.table_fields
  ADD COLUMN IF NOT EXISTS label TEXT;

-- Backfill label for existing rows (best-effort).
UPDATE public.table_fields
SET label = initcap(replace(name, '_', ' '))
WHERE label IS NULL OR btrim(label) = '';

