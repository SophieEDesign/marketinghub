-- Loop prevention for Planable ↔ Make: sync_source (hub | planable).

DO $$
DECLARE
  social_table_id uuid;
  social_table text;
  max_ord integer;
  sync_source_options jsonb;
BEGIN
  SELECT t.id, btrim(replace(coalesce(t.supabase_table, ''), 'public.', ''))
  INTO social_table_id, social_table
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

  IF social_table IS NULL OR social_table_id IS NULL THEN
    RAISE NOTICE 'Planable sync_source: Social Posts table not found — skipping.';
    RETURN;
  END IF;

  EXECUTE format(
    'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS sync_source text',
    social_table
  );

  SELECT COALESCE(MAX(order_index), MAX(position), 0)
  INTO max_ord
  FROM public.table_fields
  WHERE table_id = social_table_id;

  sync_source_options := jsonb_build_object(
    'choices',
    jsonb_build_array('hub', 'planable'),
    'selectOptions',
    jsonb_build_array(
      jsonb_build_object('label', 'hub', 'sort_index', 0),
      jsonb_build_object('label', 'planable', 'sort_index', 1)
    ),
    'read_only', true
  );

  INSERT INTO public.table_fields (
    table_id, name, type, position, order_index, group_name, required, options
  )
  VALUES (
    social_table_id,
    'sync_source',
    'single_select',
    max_ord + 1,
    max_ord + 1,
    'Planable',
    false,
    sync_source_options
  )
  ON CONFLICT (table_id, name) DO UPDATE
    SET group_name = EXCLUDED.group_name,
        type = EXCLUDED.type,
        options = EXCLUDED.options;

  RAISE NOTICE 'Planable sync_source applied on public.% (table_id %).', social_table, social_table_id;
END $$;
