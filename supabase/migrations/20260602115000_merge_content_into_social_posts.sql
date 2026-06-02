-- Merge records from the primary Content table into the dedicated Social Posts table.
-- Uses public.tables metadata so generated physical table names are resolved dynamically.
-- Safe to rerun (incremental upserts by id).

DO $$
DECLARE
  v_content_table text;
  v_social_posts_table text;
  v_common_cols text[];
  v_insert_cols_sql text;
  v_select_cols_sql text;
  v_update_set_sql text;
  v_where_clauses text[] := ARRAY[]::text[];
  v_where_sql text;
  v_change_filter_sql text;
  v_has_source_updated_at boolean := false;
  v_has_target_updated_at boolean := false;
BEGIN
  -- Resolve source Content table (prefer canonical names, then content-like names).
  SELECT replace(coalesce(t.supabase_table, ''), 'public.', '')
  INTO v_content_table
  FROM public.tables t
  WHERE coalesce(t.supabase_table, '') <> ''
    AND (
      lower(trim(t.name)) = 'content'
      OR lower(trim(t.name)) = 'content planning'
      OR (
        lower(trim(t.name)) LIKE '%content%'
        AND lower(trim(t.name)) NOT LIKE '%calendar%'
        AND lower(trim(t.name)) NOT LIKE '%briefing%'
      )
    )
  ORDER BY
    CASE
      WHEN lower(trim(t.name)) = 'content' THEN 1
      WHEN lower(trim(t.name)) = 'content planning' THEN 2
      ELSE 3
    END,
    t.created_at
  LIMIT 1;

  -- Resolve target Social Posts table.
  SELECT replace(coalesce(t.supabase_table, ''), 'public.', '')
  INTO v_social_posts_table
  FROM public.tables t
  WHERE coalesce(t.supabase_table, '') <> ''
    AND (
      lower(trim(t.name)) IN ('social posts', 'social post')
      OR (
        lower(trim(t.name)) LIKE '%social%'
        AND lower(trim(t.name)) LIKE '%post%'
        AND lower(trim(t.name)) NOT LIKE '%content planning%'
      )
    )
  ORDER BY
    CASE
      WHEN lower(trim(t.name)) = 'social posts' THEN 1
      WHEN lower(trim(t.name)) = 'social post' THEN 2
      ELSE 3
    END,
    t.created_at
  LIMIT 1;

  IF v_content_table IS NULL OR v_content_table = '' THEN
    RAISE NOTICE 'Merge skipped: could not resolve Content source table from public.tables.';
    RETURN;
  END IF;

  IF v_social_posts_table IS NULL OR v_social_posts_table = '' THEN
    RAISE NOTICE 'Merge skipped: could not resolve Social Posts target table from public.tables.';
    RETURN;
  END IF;

  IF v_content_table = v_social_posts_table THEN
    RAISE NOTICE 'Merge skipped: source and target resolve to the same table (%).', v_content_table;
    RETURN;
  END IF;

  -- Find shared columns (target order), excluding system generated columns.
  SELECT array_agg(tgt.column_name ORDER BY tgt.ordinal_position)
  INTO v_common_cols
  FROM information_schema.columns tgt
  JOIN information_schema.columns src
    ON src.table_schema = 'public'
   AND src.table_name = v_content_table
   AND src.column_name = tgt.column_name
  WHERE tgt.table_schema = 'public'
    AND tgt.table_name = v_social_posts_table
    AND tgt.column_name NOT IN ('registered_table')
    AND tgt.is_generated = 'NEVER';

  IF v_common_cols IS NULL OR cardinality(v_common_cols) = 0 THEN
    RAISE NOTICE 'Merge skipped: no shared columns between % and %.', v_content_table, v_social_posts_table;
    RETURN;
  END IF;

  IF NOT ('id' = ANY(v_common_cols)) THEN
    RAISE NOTICE 'Merge skipped: shared columns do not include id between % and %.', v_content_table, v_social_posts_table;
    RETURN;
  END IF;

  -- Keep archived/deleted records out of the merge when those columns exist.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = v_content_table
      AND c.column_name = 'is_archived'
  ) THEN
    v_where_clauses := array_append(v_where_clauses, 'coalesce(src.is_archived, false) = false');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = v_content_table
      AND c.column_name = 'deleted_at'
  ) THEN
    v_where_clauses := array_append(v_where_clauses, 'src.deleted_at IS NULL');
  END IF;

  v_where_sql := CASE
    WHEN cardinality(v_where_clauses) > 0 THEN array_to_string(v_where_clauses, ' AND ')
    ELSE 'true'
  END;

  SELECT string_agg(format('%I', c), ', ')
  INTO v_insert_cols_sql
  FROM unnest(v_common_cols) AS c;

  SELECT string_agg(format('src.%I', c), ', ')
  INTO v_select_cols_sql
  FROM unnest(v_common_cols) AS c;

  SELECT string_agg(format('%1$I = EXCLUDED.%1$I', c), ', ')
  INTO v_update_set_sql
  FROM unnest(v_common_cols) AS c
  WHERE c NOT IN ('id', 'created_at', 'created_by');

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = v_content_table
      AND c.column_name = 'updated_at'
  )
  INTO v_has_source_updated_at;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = v_social_posts_table
      AND c.column_name = 'updated_at'
  )
  INTO v_has_target_updated_at;

  -- Incremental transfer only:
  -- 1) rows not yet present in Social Posts
  -- 2) rows changed in Content since the corresponding Social Posts row
  v_change_filter_sql := 'tgt.id IS NULL';
  IF v_has_source_updated_at AND v_has_target_updated_at THEN
    v_change_filter_sql := v_change_filter_sql
      || ' OR (src.updated_at IS NOT NULL AND (tgt.updated_at IS NULL OR src.updated_at > tgt.updated_at))';
  END IF;

  EXECUTE format(
    'INSERT INTO public.%I (%s)
     SELECT %s
     FROM public.%I src
     LEFT JOIN public.%I tgt ON tgt.id = src.id
     WHERE (%s) AND (%s)
     ON CONFLICT (id) DO UPDATE
     SET %s',
    v_social_posts_table,
    v_insert_cols_sql,
    v_select_cols_sql,
    v_content_table,
    v_social_posts_table,
    v_where_sql,
    v_change_filter_sql,
    coalesce(v_update_set_sql, 'id = EXCLUDED.id')
  );

  RAISE NOTICE 'Merged content rows from public.% into public.%.', v_content_table, v_social_posts_table;
END $$;
