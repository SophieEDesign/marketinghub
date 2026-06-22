-- Planable ↔ Make sync: match key, URL, status, and last sync timestamp on Social Posts.

DO $$
DECLARE
  social_table_id uuid;
  social_table text;
  max_ord integer;
  v_field_id uuid;
  planable_status_options jsonb;
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
    RAISE NOTICE 'Planable sync fields: Social Posts table not found — skipping.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = social_table
  ) THEN
    RAISE NOTICE 'Planable sync fields: public.% missing — skipping.', social_table;
    RETURN;
  END IF;

  EXECUTE format(
    'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS planable_post_id text',
    social_table
  );
  EXECUTE format(
    'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS planable_url text',
    social_table
  );
  EXECUTE format(
    'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS planable_status text',
    social_table
  );
  EXECUTE format(
    'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS last_synced_at timestamptz',
    social_table
  );

  -- Backfill planable_url from legacy column names when present.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = social_table
      AND column_name = 'post_url'
  ) THEN
    EXECUTE format(
      $sql$
        UPDATE public.%I s
        SET planable_url = s.post_url
        WHERE (s.planable_url IS NULL OR btrim(s.planable_url) = '')
          AND s.post_url IS NOT NULL
          AND btrim(s.post_url) <> ''
      $sql$,
      social_table
    );
  END IF;

  SELECT COALESCE(MAX(order_index), MAX(position), 0)
  INTO max_ord
  FROM public.table_fields
  WHERE table_id = social_table_id;

  planable_status_options := jsonb_build_object(
    'choices',
    jsonb_build_array(
      'draft',
      'scheduled',
      'approved',
      'published',
      'error'
    ),
    'selectOptions',
    jsonb_build_array(
      jsonb_build_object('label', 'draft', 'sort_index', 0),
      jsonb_build_object('label', 'scheduled', 'sort_index', 1),
      jsonb_build_object('label', 'approved', 'sort_index', 2),
      jsonb_build_object('label', 'published', 'sort_index', 3),
      jsonb_build_object('label', 'error', 'sort_index', 4)
    )
  );

  INSERT INTO public.table_fields (
    table_id, name, type, position, order_index, group_name, required, options
  )
  VALUES
    (
      social_table_id,
      'planable_post_id',
      'text',
      max_ord + 1,
      max_ord + 1,
      'Planable',
      false,
      '{}'::jsonb
    ),
    (
      social_table_id,
      'planable_url',
      'url',
      max_ord + 2,
      max_ord + 2,
      'Planable',
      false,
      '{}'::jsonb
    ),
    (
      social_table_id,
      'planable_status',
      'single_select',
      max_ord + 3,
      max_ord + 3,
      'Planable',
      false,
      planable_status_options
    ),
    (
      social_table_id,
      'last_synced_at',
      'date',
      max_ord + 4,
      max_ord + 4,
      'Planable',
      false,
      jsonb_build_object('includeTime', true)
    )
  ON CONFLICT (table_id, name) DO UPDATE
    SET group_name = EXCLUDED.group_name,
        type = EXCLUDED.type,
        options = EXCLUDED.options;

  SELECT f.id INTO v_field_id
  FROM public.table_fields f
  WHERE f.table_id = social_table_id AND f.name = 'planable_url';

  IF v_field_id IS NOT NULL THEN
    UPDATE public.view_blocks vb
    SET
      config = COALESCE(vb.config, '{}'::jsonb)
        || jsonb_build_object(
          'social_media_calendar_post_url_field', 'planable_url',
          'social_media_calendar_post_url_field_id', v_field_id::text
        ),
      updated_at = now()
    WHERE vb.type = 'social_media_calendar'
      AND COALESCE(vb.is_archived, false) = false
      AND (
        vb.config->>'social_media_calendar_post_url_field' IS NULL
        OR btrim(vb.config->>'social_media_calendar_post_url_field') = ''
        OR lower(vb.config->>'social_media_calendar_post_url_field') IN (
          'post_url',
          'post_link',
          'planable'
        )
      );
  END IF;

  RAISE NOTICE 'Planable sync fields applied on public.% (table_id %).', social_table, social_table_id;
END $$;
