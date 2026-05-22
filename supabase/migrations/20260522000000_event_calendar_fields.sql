-- Event Calendar: interface page setup (no separate Events table — events live in Content).

-- Optional: attendance/schedule columns on Content table (skip if table missing)
DO $$
DECLARE
  content_table text;
BEGIN
  SELECT btrim(t.supabase_table)
  INTO content_table
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

  IF content_table IS NULL THEN
    RAISE NOTICE 'Event Calendar: Content table not in public.tables — skipping optional column additions.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = content_table
  ) THEN
    RAISE NOTICE 'Event Calendar: public.% missing — skipping optional column additions.', content_table;
    RETURN;
  END IF;

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

  RAISE NOTICE 'Event Calendar: optional columns on public.%', content_table;
END $$;

UPDATE public.interface_pages
SET
  is_admin_only = false,
  is_hidden = false
WHERE COALESCE(is_archived, false) = false
  AND name = 'Event Calendar';

UPDATE public.interface_pages
SET config = COALESCE(config, '{}'::jsonb) || '{"layout_style":"event_calendar"}'::jsonb
WHERE COALESCE(is_archived, false) = false
  AND name = 'Event Calendar';

-- Create page only when missing; requires exactly one anchor (saved_view on Content table)
INSERT INTO public.interface_pages (
  name,
  page_type,
  group_id,
  order_index,
  config,
  saved_view_id,
  dashboard_layout_id,
  form_config_id,
  record_config_id,
  is_admin_only,
  is_hidden,
  is_archived
)
SELECT
  'Event Calendar',
  'content',
  g.id,
  5,
  '{"layout_style":"event_calendar"}'::jsonb,
  v.id,
  NULL,
  NULL,
  NULL,
  false,
  false,
  false
FROM public.interface_groups g
CROSS JOIN LATERAL (
  SELECT v.id
  FROM public.views v
  INNER JOIN public.tables t ON t.id = v.table_id
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
  ORDER BY v.created_at NULLS LAST
  LIMIT 1
) v
WHERE lower(btrim(g.name)) IN ('public', 'other')
  AND NOT EXISTS (
    SELECT 1 FROM public.interface_pages ip
    WHERE ip.name = 'Event Calendar' AND COALESCE(ip.is_archived, false) = false
  )
ORDER BY CASE WHEN lower(btrim(g.name)) = 'public' THEN 0 ELSE 1 END
LIMIT 1;
