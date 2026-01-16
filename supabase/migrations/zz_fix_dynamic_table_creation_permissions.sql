-- Migration: Ensure newly created dynamic data tables are writable by the UI
--
-- Problem:
-- Dynamic per-table data tables are created via SECURITY DEFINER RPCs (e.g. create_dynamic_table).
-- Tables created this way can miss explicit GRANTs for the `authenticated` role, meaning:
-- - grid loads (SELECT might work in some setups)
-- - inline edits (UPDATE) fail and appear as "doesn't save"
--
-- We already have a one-time repair migration (`grant_access_to_dynamic_data_tables.sql`),
-- but this ensures *future* table creation always applies correct permissions.
--
-- Notes:
-- - We only create an RLS policy if RLS is enabled on the created table.
-- - App-level logic still gates Core Data access (admin-only).

CREATE OR REPLACE FUNCTION public.create_dynamic_table(table_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  rls_enabled boolean;
BEGIN
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS public.%I (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      created_by uuid NOT NULL DEFAULT public.current_actor_id(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by uuid NOT NULL DEFAULT public.current_actor_id()
    );
  ', table_name);

  -- Ensure standard audit fields + trigger are present (idempotent).
  PERFORM public.ensure_audit_fields_for_table('public', table_name);

  -- CRITICAL: grant DML to authenticated so inline edits work in Core Data grid.
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated;', table_name);

  -- If RLS is enabled on the table, ensure a permissive policy exists so DML works.
  SELECT c.relrowsecurity INTO rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = table_name
  LIMIT 1;

  IF COALESCE(rls_enabled, false) THEN
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can access data" ON public.%I;', table_name);
    EXECUTE format(
      'CREATE POLICY "Authenticated users can access data" ON public.%I
       FOR ALL TO authenticated
       USING (auth.role() = ''authenticated'')
       WITH CHECK (auth.role() = ''authenticated'');',
      table_name
    );
  END IF;
END;
$$;

-- Re-assert grants on the RPC itself (idempotent).
GRANT EXECUTE ON FUNCTION public.create_dynamic_table(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_dynamic_table(text) TO anon;

