-- Narrow replacement for client-side execute_sql_safe when migrating link columns uuid → uuid[].
-- execute_sql_safe was revoked from authenticated/anon for security (20260421000002).

CREATE OR REPLACE FUNCTION public.migrate_link_column_to_uuid_array(
  p_table_name text,
  p_column_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table text;
  v_col_type text;
  v_udt text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  v_table := trim(both from replace(coalesce(p_table_name, ''), 'public.', ''));

  IF v_table = '' OR coalesce(trim(p_column_name), '') = '' THEN
    RAISE EXCEPTION 'table_name and column_name are required' USING ERRCODE = '22023';
  END IF;

  -- Only allow migration on registered dynamic tables.
  IF NOT EXISTS (
    SELECT 1
    FROM public.tables t
    WHERE replace(coalesce(t.supabase_table, ''), 'public.', '') = v_table
  ) THEN
    RAISE EXCEPTION 'Table "%" is not registered', v_table USING ERRCODE = '42P01';
  END IF;

  SELECT c.data_type, c.udt_name
  INTO v_col_type, v_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = v_table
    AND c.column_name = p_column_name;

  IF v_col_type IS NULL THEN
    RAISE EXCEPTION 'Column "%" not found on table "%"', p_column_name, v_table
      USING ERRCODE = '42703';
  END IF;

  -- Already uuid[] — nothing to do.
  IF v_col_type = 'ARRAY' AND v_udt = '_uuid' THEN
    RETURN;
  END IF;

  IF v_col_type <> 'uuid' THEN
    RAISE EXCEPTION 'Column "%" is type %, expected uuid', p_column_name, v_col_type
      USING ERRCODE = '42804';
  END IF;

  EXECUTE format(
    'ALTER TABLE %I ALTER COLUMN %I TYPE uuid[] '
    || 'USING CASE WHEN %I IS NULL THEN ARRAY[]::uuid[] ELSE ARRAY[%I] END',
    v_table,
    p_column_name,
    p_column_name,
    p_column_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.migrate_link_column_to_uuid_array(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.migrate_link_column_to_uuid_array(text, text) TO authenticated;
