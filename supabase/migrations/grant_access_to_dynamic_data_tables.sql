-- Migration: Grant access to dynamic per-table data tables
--
-- Core Data "views" (Airtable-style grid) read/write directly against the physical
-- tables referenced by `public.tables.supabase_table` (e.g. `table_events_...`).
--
-- Depending on how these tables were created (via SECURITY DEFINER RPCs / SQL),
-- they can end up missing GRANTs for the `authenticated` role. In that case the UI
-- can load rows (SELECT might work) but inline edits (UPDATE) fail and appear as
-- "doesn't save".
--
-- This migration is idempotent:
-- - Ensures authenticated has SELECT/INSERT/UPDATE/DELETE on each referenced table
-- - If RLS is enabled on a referenced table, ensures a permissive policy exists
--   for authenticated users (app-level logic still gates Core Data access).

DO $$
DECLARE
  r record;
  rls_enabled boolean;
BEGIN
  FOR r IN
    SELECT DISTINCT btrim(t.supabase_table) AS table_name
    FROM public.tables t
    WHERE t.supabase_table IS NOT NULL
      AND btrim(t.supabase_table) <> ''
  LOOP
    -- Only operate on tables that actually exist.
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables it
      WHERE it.table_schema = 'public'
        AND it.table_name = r.table_name
    ) THEN
      -- Ensure basic DML permissions for authenticated users.
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated;', r.table_name);

      -- If RLS is enabled on the table, ensure a permissive policy exists so DML works.
      SELECT c.relrowsecurity INTO rls_enabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = r.table_name
      LIMIT 1;

      IF COALESCE(rls_enabled, false) THEN
        -- Drop/recreate to ensure UPDATE is covered.
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can access data" ON public.%I;', r.table_name);
        EXECUTE format(
          'CREATE POLICY "Authenticated users can access data" ON public.%I
           FOR ALL TO authenticated
           USING (auth.role() = ''authenticated'')
           WITH CHECK (auth.role() = ''authenticated'');',
          r.table_name
        );
      END IF;
    END IF;
  END LOOP;
END $$;

