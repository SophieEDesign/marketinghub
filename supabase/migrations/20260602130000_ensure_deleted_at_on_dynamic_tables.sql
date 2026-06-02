-- Ensure deleted_at exists on all dynamic record tables (e.g. dedicated Events tables).
-- Soft delete uses UPDATE deleted_at; grids and record editors skip hard DELETE.

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

      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%I_deleted_at ON public.%I (deleted_at) WHERE deleted_at IS NULL;',
        r.table_name,
        r.table_name
      );
    END IF;
  END LOOP;
END $$;
