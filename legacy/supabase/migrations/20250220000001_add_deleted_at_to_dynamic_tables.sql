-- Migration: Add deleted_at to dynamic record tables for soft delete
--
-- Enables soft delete on all table_* (dynamic record) tables.
-- Existing rows have deleted_at = NULL (visible).
-- Soft delete: UPDATE SET deleted_at = now() instead of DELETE.
--
-- Also updates create_dynamic_table() so new tables include deleted_at.

DO $$
DECLARE
  r record;
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
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables it2
      WHERE it2.table_schema = 'public'
        AND it2.table_name = r.table_name
    ) THEN
      -- Add deleted_at if not present
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = r.table_name
          AND c.column_name = 'deleted_at'
      ) THEN
        EXECUTE format(
          'ALTER TABLE public.%I ADD COLUMN deleted_at timestamptz;',
          r.table_name
        );
      END IF;

      -- Add partial index for efficient filtering (WHERE deleted_at IS NULL)
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%I_deleted_at ON public.%I (deleted_at) WHERE deleted_at IS NULL;',
        r.table_name,
        r.table_name
      );
    END IF;
  END LOOP;
END $$;

-- Update create_dynamic_table to include deleted_at for new tables
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
      updated_by uuid NOT NULL DEFAULT public.current_actor_id(),
      deleted_at timestamptz
    );
  ', table_name);

  -- Add deleted_at to existing tables created without it
  EXECUTE format('
    ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
  ', table_name);

  -- Ensure standard audit fields + trigger are present (idempotent).
  PERFORM public.ensure_audit_fields_for_table('public', table_name);

  -- CRITICAL: grant DML to authenticated so inline edits work in Core Data grid.
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated;', table_name);

  -- Add partial index for deleted_at filtering
  EXECUTE format('
    CREATE INDEX IF NOT EXISTS idx_%I_deleted_at ON public.%I (deleted_at) WHERE deleted_at IS NULL;
  ', table_name, table_name);

  -- If RLS is enabled on the table, ensure a permissive policy exists so DML works.
  SELECT c.relrowsecurity INTO rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = table_name
  LIMIT 1;

  IF COALESCE(rls_enabled, false) THEN
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can access data" ON public.%I;', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can select" ON public.%I;', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can insert" ON public.%I;', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can update" ON public.%I;', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "block_hard_delete_dynamic" ON public.%I;', table_name);
    EXECUTE format(
      'CREATE POLICY "Authenticated users can select" ON public.%I
       FOR SELECT TO authenticated USING (auth.role() = ''authenticated'');',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY "Authenticated users can insert" ON public.%I
       FOR INSERT TO authenticated WITH CHECK (auth.role() = ''authenticated'');',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY "Authenticated users can update" ON public.%I
       FOR UPDATE TO authenticated USING (auth.role() = ''authenticated'')
       WITH CHECK (auth.role() = ''authenticated'');',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY "block_hard_delete_dynamic" ON public.%I
       FOR DELETE TO authenticated USING (false);',
      table_name
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_dynamic_table(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_dynamic_table(text) TO anon;
