-- Internal Resource Hub: hub_category column on Media/Resources table, field metadata, block mappings, backfill.

DO $$
DECLARE
  media_table_id uuid;
  media_table text;
  max_ord integer;
  v_field_id uuid;
  mapping jsonb;
  pair record;
  hub_options jsonb;
BEGIN
  SELECT t.id, btrim(t.supabase_table)
  INTO media_table_id, media_table
  FROM public.tables t
  WHERE t.supabase_table IS NOT NULL
    AND btrim(t.supabase_table) <> ''
    AND lower(btrim(t.name)) ~ 'media'
    AND (
      lower(btrim(t.name)) ~ 'resource'
      OR lower(btrim(t.name)) ~ 'link'
      OR lower(btrim(t.name)) = 'media'
    )
  ORDER BY
    CASE
      WHEN lower(btrim(t.name)) ~ 'resource' AND lower(btrim(t.name)) ~ 'link' THEN 0
      WHEN lower(btrim(t.name)) ~ 'resource' THEN 1
      ELSE 2
    END
  LIMIT 1;

  IF media_table IS NULL OR media_table_id IS NULL THEN
    RAISE NOTICE 'Resource Hub category: Media table not found in public.tables — skipping.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = media_table
  ) THEN
    RAISE NOTICE 'Resource Hub category: public.% missing — skipping.', media_table;
    RETURN;
  END IF;

  EXECUTE format(
    'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS hub_category text',
    media_table
  );

  hub_options := jsonb_build_object(
    'choices',
    jsonb_build_array(
      'Logos',
      'Brand Guidelines',
      'Images',
      'Templates',
      'Documents',
      'Videos',
      'Presentations'
    ),
    'selectOptions',
    jsonb_build_array(
      jsonb_build_object('label', 'Logos', 'sort_index', 0),
      jsonb_build_object('label', 'Brand Guidelines', 'sort_index', 1),
      jsonb_build_object('label', 'Images', 'sort_index', 2),
      jsonb_build_object('label', 'Templates', 'sort_index', 3),
      jsonb_build_object('label', 'Documents', 'sort_index', 4),
      jsonb_build_object('label', 'Videos', 'sort_index', 5),
      jsonb_build_object('label', 'Presentations', 'sort_index', 6)
    )
  );

  SELECT COALESCE(MAX(order_index), MAX(position), 0) INTO max_ord
  FROM public.table_fields
  WHERE table_id = media_table_id;

  INSERT INTO public.table_fields (
    table_id, name, type, position, order_index, group_name, required, options
  )
  VALUES (
    media_table_id,
    'hub_category',
    'single_select',
    max_ord + 1,
    max_ord + 1,
    'Resources',
    false,
    hub_options
  )
  ON CONFLICT (table_id, name) DO UPDATE
    SET type = 'single_select',
        group_name = EXCLUDED.group_name,
        options = EXCLUDED.options;

  -- Backfill from legacy status + file URL extension (stored as select labels)
  EXECUTE format(
    $sql$
      UPDATE public.%I m
      SET hub_category = CASE
        WHEN m.hub_category IS NOT NULL AND btrim(m.hub_category) <> '' THEN m.hub_category
        WHEN m.status ~* 'logo' THEN 'Logos'
        WHEN m.status ~* 'brand' OR m.status ~* 'guideline' THEN 'Brand Guidelines'
        WHEN m.status ~* 'template' THEN 'Templates'
        WHEN m.status ~* 'video' THEN 'Videos'
        WHEN m.document_link ~* '\.(pptx|ppt)(\?|$|")' THEN 'Presentations'
        WHEN m.document_link ~* '\.(png|jpe?g|svg)(\?|$|")' THEN 'Images'
        ELSE 'Documents'
      END
      WHERE m.hub_category IS NULL OR btrim(m.hub_category) = ''
    $sql$,
    media_table
  );

  mapping := jsonb_build_object(
    'table_id', media_table_id::text,
    'resource_hub_title_field', 'name',
    'resource_hub_file_url_field', 'document_link',
    'resource_hub_description_field', 'notes',
    'resource_hub_category_field', 'hub_category',
    'resource_hub_uploaded_by_field', 'assignee',
    'resource_hub_updated_at_field', 'updated_at'
  );

  FOR pair IN
    SELECT e.key AS cfg_key, e.value AS col_name
    FROM jsonb_each_text(mapping) e
    WHERE e.key LIKE 'resource_hub_%\_field' ESCAPE '\'
      AND e.key NOT LIKE '%\_field\_id' ESCAPE '\'
  LOOP
    SELECT f.id INTO v_field_id
    FROM public.table_fields f
    WHERE f.table_id = media_table_id AND f.name = pair.col_name;
    IF v_field_id IS NOT NULL THEN
      mapping := mapping || jsonb_build_object(
        replace(pair.cfg_key, '_field', '_field_id'),
        v_field_id::text
      );
    END IF;
  END LOOP;

  UPDATE public.view_blocks vb
  SET
    config = COALESCE(vb.config, '{}'::jsonb) || mapping,
    updated_at = now()
  WHERE vb.type = 'internal_resource_hub'
    AND COALESCE(vb.is_archived, false) = false
    AND (
      vb.config->>'resource_hub_category_field' IS NULL
      OR btrim(vb.config->>'resource_hub_category_field') = ''
      OR vb.config->>'resource_hub_category_field' = 'status'
    );

  RAISE NOTICE 'Resource Hub: hub_category applied for public.% (table_id %)', media_table, media_table_id;
END $$;
