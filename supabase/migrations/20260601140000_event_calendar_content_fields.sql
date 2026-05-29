-- Event Calendar audit: Content table columns, table_fields metadata, default block field mappings.
-- Events are Content rows (content_type = Event) unless block table_id points elsewhere.
-- event_attendance.event_id references the source table row id (see 20260601120000_event_attendance.sql).

-- ---------------------------------------------------------------------------
-- Resolve Marketing Hub Content table (same rules as 20260522000000)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  content_table text;
  content_table_id uuid;
  locations_table text;
  max_ord integer;
  fld record;
  pair record;
  v_field_id uuid;
  mapping jsonb;
BEGIN
  SELECT t.id, btrim(t.supabase_table)
  INTO content_table_id, content_table
  FROM public.tables t
  WHERE t.supabase_table IS NOT NULL
    AND btrim(t.supabase_table) <> ''
    AND (
      lower(btrim(t.name)) = 'content'
      OR (
        lower(btrim(t.name)) ~ 'content'
        AND lower(btrim(t.name)) !~ 'calendar'
        AND lower(btrim(t.name)) !~ 'briefing'
      )
    )
  ORDER BY CASE WHEN lower(btrim(t.name)) = 'content' THEN 0 ELSE 1 END
  LIMIT 1;

  IF content_table IS NULL OR content_table_id IS NULL THEN
    RAISE NOTICE 'Event Calendar fields: Content table not found in public.tables — skipping.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = content_table
  ) THEN
    RAISE NOTICE 'Event Calendar fields: public.% missing — skipping.', content_table;
    RETURN;
  END IF;

  SELECT btrim(t.supabase_table)
  INTO locations_table
  FROM public.tables t
  WHERE t.supabase_table IS NOT NULL
    AND btrim(t.supabase_table) <> ''
    AND lower(btrim(t.name)) ~ 'location'
  ORDER BY CASE WHEN lower(btrim(t.name)) = 'locations' THEN 0 ELSE 1 END
  LIMIT 1;

  -- Physical columns used by EventFieldMap / block event_calendar_* settings
  EXECUTE format(
    'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS attendee_user_ids uuid[] DEFAULT ''{}''::uuid[]',
    content_table
  );
  EXECUTE format(
    'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS schedule_items jsonb DEFAULT ''[]''::jsonb',
    content_table
  );
  EXECUTE format(
    'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS resources jsonb DEFAULT ''[]''::jsonb',
    content_table
  );
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS event_type text', content_table);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS visibility text', content_table);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS location_name text', content_table);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS city text', content_table);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS country text', content_table);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS venue text', content_table);
  EXECUTE format(
    'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS all_day boolean DEFAULT true',
    content_table
  );
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS start_time text', content_table);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS end_time text', content_table);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS timezone text', content_table);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS event_budget text', content_table);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS internal_notes text', content_table);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at timestamptz', content_table);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS quarterly_theme uuid', content_table);

  -- Linked location (FK → Locations table when present)
  IF locations_table IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = locations_table
    )
  THEN
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS location uuid', content_table);

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_schema = 'public'
        AND table_name = content_table
        AND constraint_name = content_table || '_location_fkey'
    ) THEN
      EXECUTE format(
        'UPDATE public.%I SET location = NULL WHERE location IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.%I l WHERE l.id = %I.location
        )',
        content_table,
        locations_table,
        content_table
      );
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (location) REFERENCES public.%I(id) ON DELETE SET NULL',
        content_table,
        content_table || '_location_fkey',
        locations_table
      );
    END IF;
  END IF;

  -- table_fields metadata (idempotent)
  SELECT COALESCE(MAX(order_index), MAX(position), 0) INTO max_ord
  FROM public.table_fields
  WHERE table_id = content_table_id;

  FOR fld IN
    SELECT *
    FROM (
      VALUES
        ('event_type', 'single_select', 'Events', 1),
        ('visibility', 'single_select', 'Events', 2),
        ('location', 'link_to_table', 'Events', 3),
        ('location_name', 'text', 'Events', 4),
        ('city', 'text', 'Events', 5),
        ('country', 'text', 'Events', 6),
        ('venue', 'text', 'Events', 7),
        ('all_day', 'checkbox', 'Events', 8),
        ('start_time', 'text', 'Events', 9),
        ('end_time', 'text', 'Events', 10),
        ('timezone', 'text', 'Events', 11),
        ('event_budget', 'text', 'Events', 12),
        ('internal_notes', 'long_text', 'Events', 13),
        ('deleted_at', 'date', 'Events', 14),
        ('attendee_user_ids', 'multi_select', 'Events', 15),
        ('schedule_items', 'json', 'Events', 16),
        ('resources', 'json', 'Events', 17)
    ) AS v(name, typ, grp, ord_off)
  LOOP
    INSERT INTO public.table_fields (
      table_id, name, type, position, order_index, group_name, required, options
    )
    VALUES (
      content_table_id,
      fld.name,
      fld.typ,
      max_ord + fld.ord_off,
      max_ord + fld.ord_off,
      fld.grp,
      false,
      '{}'::jsonb
    )
    ON CONFLICT (table_id, name) DO UPDATE
      SET group_name = EXCLUDED.group_name,
          type = COALESCE(NULLIF(EXCLUDED.type, ''), public.table_fields.type);
  END LOOP;

  -- Default block mappings (field names + field_ids) for Event Calendar blocks missing table_id
  mapping := jsonb_build_object(
    'table_id', content_table_id::text,
    'event_calendar_title_field', 'content_name',
    'event_calendar_content_type_field', 'content_type',
    'event_calendar_start_date_field', 'date',
    'event_calendar_end_date_field', 'date_to',
    'event_calendar_event_type_field', 'event_type',
    'event_calendar_status_field', 'status',
    'event_calendar_visibility_field', 'visibility',
    'event_calendar_location_link_field', 'location',
    'event_calendar_location_field', 'location_name',
    'event_calendar_city_field', 'city',
    'event_calendar_country_field', 'country',
    'event_calendar_venue_field', 'venue',
    'event_calendar_all_day_field', 'all_day',
    'event_calendar_start_time_field', 'start_time',
    'event_calendar_end_time_field', 'end_time',
    'event_calendar_timezone_field', 'timezone',
    'event_calendar_hero_image_field', 'images',
    'event_calendar_theme_field', 'quarterly_theme',
    'event_calendar_campaign_field', 'campaigns',
    'event_calendar_owner_field', 'owner',
    'event_calendar_budget_field', 'event_budget',
    'event_calendar_notes_field', 'internal_notes',
    'event_calendar_description_field', 'notes_detail',
    'event_calendar_url_field', 'website',
    'event_calendar_attending_field', 'attendee_user_ids',
    'event_calendar_schedule_field', 'schedule_items',
    'event_calendar_resources_field', 'resources',
    'event_calendar_deleted_at_field', 'deleted_at',
    'event_calendar_submitted_status_value', 'Submitted',
    'event_calendar_approved_status_value', 'Published',
    'event_calendar_rejected_status_value', 'Cancelled',
    'event_calendar_member_default_visibility', 'members_only',
    'event_calendar_content_type_default', 'Event'
  );

  FOR pair IN
    SELECT e.key AS cfg_key, e.value AS col_name
    FROM jsonb_each_text(mapping) e
    WHERE e.key LIKE 'event_calendar_%\_field' ESCAPE '\'
      AND e.key NOT LIKE '%\_field\_id' ESCAPE '\'
  LOOP
    SELECT f.id INTO v_field_id
    FROM public.table_fields f
    WHERE f.table_id = content_table_id AND f.name = pair.col_name;
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
  WHERE vb.type = 'event_calendar'
    AND COALESCE(vb.is_archived, false) = false
    AND (
      vb.config->>'table_id' IS NULL
      OR btrim(vb.config->>'table_id') = ''
    );

  RAISE NOTICE 'Event Calendar: columns + mappings applied for public.% (table_id %)', content_table, content_table_id;
END $$;
