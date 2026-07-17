-- Narrow DDL for adding columns on registered dynamic tables.
-- Replaces execute_sql_safe for field creation when that function is service_role-only.

CREATE OR REPLACE FUNCTION public.add_registered_table_column(
  p_table_name text,
  p_column_name text,
  p_column_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table text;
  v_col text;
  v_type text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  v_table := trim(both from replace(coalesce(p_table_name, ''), 'public.', ''));
  v_col := trim(both from coalesce(p_column_name, ''));
  v_type := lower(trim(both from coalesce(p_column_type, '')));

  IF v_table = '' OR v_col = '' OR v_type = '' THEN
    RAISE EXCEPTION 'table_name, column_name, and column_type are required' USING ERRCODE = '22023';
  END IF;

  IF lower(v_col) IN ('created_at', 'created_by', 'updated_at', 'updated_by', 'id') THEN
    RAISE EXCEPTION 'Column name "%" is reserved.', v_col USING ERRCODE = '22023';
  END IF;

  IF v_type NOT IN ('text', 'numeric', 'timestamptz', 'boolean', 'jsonb', 'uuid', 'uuid[]') THEN
    RAISE EXCEPTION 'Unsupported column type "%"', v_type USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tables t
    WHERE replace(coalesce(t.supabase_table, ''), 'public.', '') = v_table
  ) THEN
    RAISE EXCEPTION 'Table "%" is not registered', v_table USING ERRCODE = '42P01';
  END IF;

  EXECUTE format(
    'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s',
    v_table,
    v_col,
    v_type
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.drop_registered_table_column(
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
  v_col text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  v_table := trim(both from replace(coalesce(p_table_name, ''), 'public.', ''));
  v_col := trim(both from coalesce(p_column_name, ''));

  IF v_table = '' OR v_col = '' THEN
    RAISE EXCEPTION 'table_name and column_name are required' USING ERRCODE = '22023';
  END IF;

  IF lower(v_col) IN ('created_at', 'created_by', 'updated_at', 'updated_by', 'id') THEN
    RAISE EXCEPTION 'Column name "%" is reserved.', v_col USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tables t
    WHERE replace(coalesce(t.supabase_table, ''), 'public.', '') = v_table
  ) THEN
    RAISE EXCEPTION 'Table "%" is not registered', v_table USING ERRCODE = '42P01';
  END IF;

  EXECUTE format(
    'ALTER TABLE public.%I DROP COLUMN IF EXISTS %I',
    v_table,
    v_col
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_registered_table_column(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.drop_registered_table_column(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.add_registered_table_column(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.drop_registered_table_column(text, text) TO authenticated;
