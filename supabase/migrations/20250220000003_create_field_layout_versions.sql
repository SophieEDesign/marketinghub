-- Migration: Create field_layout_versions table for layout versioning
--
-- Enables version history before overwriting field_layout in view_blocks.config.
-- Prevents accidental layout loss.

CREATE TABLE IF NOT EXISTS public.field_layout_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('page', 'block', 'record')),
  entity_id uuid NOT NULL,
  layout_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_field_layout_versions_entity
  ON public.field_layout_versions(entity_type, entity_id, created_at DESC);

-- RLS: Allow authenticated users to read and insert (versioning is append-only)
ALTER TABLE public.field_layout_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read field layout versions" ON public.field_layout_versions;
CREATE POLICY "Authenticated users can read field layout versions"
  ON public.field_layout_versions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert field layout versions" ON public.field_layout_versions;
CREATE POLICY "Authenticated users can insert field layout versions"
  ON public.field_layout_versions FOR INSERT
  TO authenticated
  WITH CHECK (true);
