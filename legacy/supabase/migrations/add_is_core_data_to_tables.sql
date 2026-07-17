-- Add is_core_data to public.tables for record navigation rules.
-- Only tables with is_core_data = true may open as full-page record routes;
-- all other records open in the RecordPanel modal (Airtable-style).
ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS is_core_data boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tables.is_core_data IS
  'When true, records may be opened as full-page routes (/tables/:id/records/:rid). When false, record opens use the RecordPanel modal only.';
