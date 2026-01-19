-- Migration: Ensure dynamic data tables are writable for authenticated users
--
-- Symptom:
-- - Admin user can create records, but newly added users cannot (INSERT fails).
--
-- Root cause (common):
-- - Per-table physical tables (e.g. public.table_content_...) are missing GRANTs and/or
--   have RLS enabled without permissive INSERT/UPDATE policies for the `authenticated` role.
--
-- This migration is idempotent:
-- - Grants SELECT/INSERT/UPDATE/DELETE on all dynamic tables to `authenticated`
-- - If RLS is enabled on a dynamic table, ensures a permissive FOR ALL policy exists
--
-- Dynamic tables are detected via:
-- - `public.tables.supabase_table` metadata
-- - Any `public.table_%` tables found in information_schema (safety net)

DO $$
DECLARE
  r record;
  rls_enabled boolean;
BEGIN
  FOR r IN
    SELECT DISTINCT table_name
    FROM (
      SELECT btrim(t.supabase_table) AS table_name
      FROM public.tables t
      WHERE t.supabase_table IS NOT NULL
        AND btrim(t.supabase_table) <> ''
      UNION
      SELECT it.table_name
      FROM information_schema.tables it
      WHERE it.table_schema = 'public'
        AND it.table_name LIKE 'table\_%' ESCAPE '\'
    ) s
  LOOP
    -- Only operate on tables that actually exist.
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables it2
      WHERE it2.table_schema = 'public'
        AND it2.table_name = r.table_name
    ) THEN
      -- Ensure basic DML permissions for authenticated users.
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated;',
        r.table_name
      );

      -- If RLS is enabled on the table, ensure a permissive policy exists so DML works.
      SELECT c.relrowsecurity INTO rls_enabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = r.table_name
      LIMIT 1;

      IF COALESCE(rls_enabled, false) THEN
        EXECUTE format(
          'DROP POLICY IF EXISTS "Authenticated users can access data" ON public.%I;',
          r.table_name
        );

        -- Note: restricting to role "authenticated" is sufficient; no need for auth.role() checks.
        EXECUTE format(
          'CREATE POLICY "Authenticated users can access data" ON public.%I
           FOR ALL TO authenticated
           USING (true)
           WITH CHECK (true);',
          r.table_name
        );
      END IF;
    END IF;
  END LOOP;
END $$;

