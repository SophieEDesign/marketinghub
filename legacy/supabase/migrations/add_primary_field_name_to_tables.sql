-- Add per-table primary field setting (record label / default field).
-- This stores the INTERNAL field name (snake_case column) or 'id'.
-- When NULL, the app falls back to the computed primary field (first non-system field).

ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS primary_field_name TEXT;

-- Optional index to speed lookups in UI (not strictly necessary).
CREATE INDEX IF NOT EXISTS idx_tables_primary_field_name
  ON public.tables(primary_field_name);

