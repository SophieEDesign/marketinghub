-- Provision Event Calendar page with event_calendar block (replaces layout_style-only page shell).
-- Safe to re-run: only inserts block when the page has no blocks yet.

DO $$
DECLARE
  v_page_id uuid;
BEGIN
  SELECT id INTO v_page_id
  FROM public.interface_pages
  WHERE name = 'Event Calendar'
    AND COALESCE(is_archived, false) = false
  ORDER BY created_at NULLS LAST
  LIMIT 1;

  IF v_page_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.interface_pages
  SET config = COALESCE(config, '{}'::jsonb) - 'layout_style'
  WHERE id = v_page_id
    AND config ? 'layout_style'
    AND config->>'layout_style' = 'event_calendar';

  IF EXISTS (SELECT 1 FROM public.view_blocks WHERE page_id = v_page_id LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO public.view_blocks (
    page_id,
    type,
    position_x,
    position_y,
    width,
    height,
    config
  )
  VALUES (
    v_page_id,
    'event_calendar',
    0,
    0,
    12,
    14,
    '{
      "title": "Event Calendar",
      "is_full_page": true,
      "event_calendar_subtitle": "Plan, manage and track marketing events, trade shows and activations.",
      "event_calendar_default_view": "month",
      "event_calendar_show_toolbar": true,
      "event_calendar_show_metrics": true,
      "event_calendar_show_filters": true,
      "event_calendar_show_search": true,
      "event_calendar_show_add_button": true,
      "event_calendar_show_attendance_controls": true,
      "event_calendar_show_schedule": true,
      "event_calendar_show_resources": true,
      "event_calendar_show_notes": true,
      "event_calendar_show_legend": true,
      "event_calendar_density": "comfortable",
      "appearance": { "showTitle": false }
    }'::jsonb
  );
END $$;
