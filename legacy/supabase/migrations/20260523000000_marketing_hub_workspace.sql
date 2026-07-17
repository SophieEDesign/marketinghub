-- Marketing Hub workspace: seven Interface Builder pages, block canvas (no layout_style bypass).
-- Idempotent: safe to re-run. Complements baserow-app/scripts/apply-marketing-hub-workspace.cjs

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.marketing_hub_resolve_page_id(p_names text[])
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT ip.id
  FROM public.interface_pages ip
  WHERE COALESCE(ip.is_archived, false) = false
    AND ip.name = ANY (p_names)
  ORDER BY
    array_position(p_names, ip.name),
    (
      SELECT COUNT(*)
      FROM public.view_blocks vb
      WHERE vb.page_id = ip.id
        AND COALESCE(vb.is_archived, false) = false
        AND vb.config->>'provisioning_key' IS NOT NULL
    ) DESC,
    ip.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.marketing_hub_upsert_block(
  p_page_id uuid,
  p_key text,
  p_type text,
  p_x integer,
  p_y integer,
  p_w integer,
  p_h integer,
  p_config jsonb,
  p_order integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
  v_config jsonb;
BEGIN
  IF p_page_id IS NULL THEN
    RETURN;
  END IF;

  v_config := COALESCE(p_config, '{}'::jsonb) || jsonb_build_object('provisioning_key', p_key);

  SELECT vb.id
  INTO v_id
  FROM public.view_blocks vb
  WHERE vb.page_id = p_page_id
    AND COALESCE(vb.is_archived, false) = false
    AND (
      vb.config->>'provisioning_key' = p_key
      OR (
        vb.config->>'provisioning_key' IS NULL
        AND vb.type = p_type
        AND COALESCE(vb.config->>'title', '') = COALESCE(p_config->>'title', '')
      )
    )
  ORDER BY vb.order_index NULLS LAST, vb.created_at NULLS LAST
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.view_blocks
    SET
      type = p_type,
      position_x = p_x,
      position_y = p_y,
      width = p_w,
      height = p_h,
      config = v_config,
      order_index = p_order,
      updated_at = now()
    WHERE id = v_id;
  ELSE
    INSERT INTO public.view_blocks (
      page_id, view_id, type, position_x, position_y, width, height, config, order_index, is_archived
    )
    VALUES (p_page_id, NULL, p_type, p_x, p_y, p_w, p_h, v_config, p_order, false);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.marketing_hub_archive_orphan_blocks(
  p_page_id uuid,
  p_keys text[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_page_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.view_blocks vb
  SET is_archived = true, archived_at = now(), updated_at = now()
  WHERE vb.page_id = p_page_id
    AND COALESCE(vb.is_archived, false) = false
    AND COALESCE(vb.config->>'provisioning_key', vb.type || '::' || COALESCE(vb.config->>'title', '')) <> ALL (p_keys);
END;
$$;

-- ---------------------------------------------------------------------------
-- Page renames, config, visibility, archive deprecated
-- ---------------------------------------------------------------------------

UPDATE public.interface_pages
SET
  name = 'Marketing Home',
  config = jsonb_build_object('is_home', true),
  is_admin_only = false,
  is_hidden = false
WHERE COALESCE(is_archived, false) = false
  AND name IN ('Dashboard', 'Marketing Dashboard', 'Marketing Home');

UPDATE public.interface_pages
SET
  name = 'Resource Hub',
  config = '{}'::jsonb,
  is_admin_only = false,
  is_hidden = false
WHERE COALESCE(is_archived, false) = false
  AND name IN ('Internal Staff Hub', 'Internal Marketing Hub', 'Resource Hub');

UPDATE public.interface_pages
SET
  name = 'Social Calendar',
  config = '{}'::jsonb,
  is_admin_only = false,
  is_hidden = false
WHERE COALESCE(is_archived, false) = false
  AND name IN ('Social Media Calendar', 'Social Media', 'Social Calendar');

UPDATE public.interface_pages
SET config = '{}'::jsonb, is_admin_only = false, is_hidden = false
WHERE COALESCE(is_archived, false) = false
  AND name IN ('Theme Workspace', 'Content Planning', 'Event Calendar', 'Things To Do');

UPDATE public.interface_pages
SET config = COALESCE(config, '{}'::jsonb) - 'layout_style'
WHERE COALESCE(is_archived, false) = false
  AND config ? 'layout_style';

UPDATE public.interface_pages
SET is_archived = true, is_hidden = true, is_admin_only = true
WHERE COALESCE(is_archived, false) = false
  AND name IN (
    'Campaign Archive',
    'Campaign Workspace',
    'Campaign Dashboard',
    'Marketing Dashboard (Theme-led)',
    'Marketing Dashboard'
  );

-- Things To Do page (create when missing)
INSERT INTO public.interface_pages (
  name, page_type, group_id, order_index, config, saved_view_id,
  dashboard_layout_id, form_config_id, record_config_id,
  is_admin_only, is_hidden, is_archived
)
SELECT
  'Things To Do',
  'content',
  src.group_id,
  3,
  '{}'::jsonb,
  src.saved_view_id,
  NULL, NULL, NULL,
  false, false, false
FROM public.interface_pages src
WHERE COALESCE(src.is_archived, false) = false
  AND src.name = 'Content Planning'
  AND NOT EXISTS (
    SELECT 1 FROM public.interface_pages ip
    WHERE ip.name = 'Things To Do' AND COALESCE(ip.is_archived, false) = false
  )
  LIMIT 1;

-- Social Calendar page (create when missing)
INSERT INTO public.interface_pages (
  name, page_type, group_id, order_index, config, saved_view_id,
  dashboard_layout_id, form_config_id, record_config_id,
  is_admin_only, is_hidden, is_archived
)
SELECT
  'Social Calendar',
  'content',
  src.group_id,
  5,
  '{}'::jsonb,
  src.saved_view_id,
  NULL, NULL, NULL,
  false, false, false
FROM public.interface_pages src
WHERE COALESCE(src.is_archived, false) = false
  AND src.name = 'Content Planning'
  AND NOT EXISTS (
    SELECT 1 FROM public.interface_pages ip
    WHERE COALESCE(ip.is_archived, false) = false
      AND ip.name IN ('Social Calendar', 'Social Media Calendar', 'Social Media')
  )
LIMIT 1;

-- Archive duplicate active pages with the same hub name (keep best-provisioned / oldest)
WITH ranked AS (
  SELECT
    ip.id,
    ROW_NUMBER() OVER (
      PARTITION BY ip.name
      ORDER BY
        (
          SELECT COUNT(*)
          FROM public.view_blocks vb
          WHERE vb.page_id = ip.id
            AND COALESCE(vb.is_archived, false) = false
            AND vb.config->>'provisioning_key' IS NOT NULL
        ) DESC,
        ip.created_at ASC
    ) AS rn
  FROM public.interface_pages ip
  WHERE COALESCE(ip.is_archived, false) = false
    AND ip.name IN ('Marketing Home')
)
UPDATE public.interface_pages ip
SET
  is_archived = true,
  is_hidden = true,
  is_admin_only = true,
  updated_at = now(),
  config = COALESCE(ip.config, '{}'::jsonb) - 'is_home'
FROM ranked r
WHERE ip.id = r.id
  AND r.rn > 1;

-- Sidebar order
DO $$
DECLARE
  r RECORD;
  idx integer := 0;
BEGIN
  FOR r IN
    SELECT unnest(ARRAY[
      'Marketing Home',
      'Theme Workspace',
      'Content Planning',
      'Things To Do',
      'Resource Hub',
      'Social Calendar',
      'Event Calendar'
    ]) AS page_name
  LOOP
    UPDATE public.interface_pages
    SET order_index = idx, is_admin_only = false, is_hidden = false
    WHERE COALESCE(is_archived, false) = false
      AND name = r.page_name;
    idx := idx + 1;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Block layouts (provisioning_key sync per page)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_page uuid;
  v_keys text[];
BEGIN
  -- Marketing Home
  v_page := public.marketing_hub_resolve_page_id(ARRAY['Marketing Home', 'Dashboard', 'Marketing Dashboard']);
  v_keys := ARRAY['home_intro','home_kpi','home_themes','home_todo','home_resources','home_timeline','home_events'];
  PERFORM public.marketing_hub_upsert_block(v_page, 'home_intro', 'html', 0, 0, 12, 2,
    '{"title":"Marketing Hub intro","html":"<div class=\"px-1 py-2\"><h1 class=\"text-2xl font-bold tracking-tight text-[#111827] md:text-3xl\">Marketing Hub</h1><p class=\"mt-1 text-sm text-[#6B7280]\">Plan campaigns, content, resources and activity from one shared workspace.</p></div>"}'::jsonb, 0);
  PERFORM public.marketing_hub_upsert_block(v_page, 'home_kpi', 'kpi_summary', 0, 2, 12, 3,
    '{"title":"Marketing Overview","kpi_summary_cards":[{"id":"active-campaigns","label":"Active Campaigns","value":"12","trend":"↑ 20% vs last 7 days","trend_direction":"up","icon":"rocket","accent":"purple"},{"id":"content-scheduled","label":"Content Scheduled","value":"48","trend":"↑ 16% vs last 7 days","trend_direction":"up","icon":"calendar","accent":"blue"},{"id":"engagement","label":"Engagement","value":"8.3K","trend":"↑ 12% vs last 7 days","trend_direction":"up","icon":"barchart","accent":"purple"},{"id":"events-month","label":"Events This Month","value":"5","trend":"↓ 10% vs last month","trend_direction":"down","icon":"calendardays","accent":"red"}]}'::jsonb, 1);
  PERFORM public.marketing_hub_upsert_block(v_page, 'home_themes', 'content_theme', 0, 5, 8, 8,
    '{"title":"Content Themes","content_theme_subtitle":"Strategic themes and content focus areas for the quarter.","content_theme_year":2026,"content_theme_quarter":"Q2","content_theme_show_filters":true,"content_theme_highlight_current_quarter":true,"content_theme_view_mode":"grid"}'::jsonb, 2);
  PERFORM public.marketing_hub_upsert_block(v_page, 'home_todo', 'things_to_do', 8, 5, 4, 4,
    '{"title":"Things To Do","things_to_do_subtitle":"Content actions that need attention.","things_to_do_compact_mode":true,"things_to_do_max_items":5,"things_to_do_show_stats":true,"things_to_do_show_filters":false,"appearance":{"showTitle":true}}'::jsonb, 3);
  PERFORM public.marketing_hub_upsert_block(v_page, 'home_resources', 'internal_resource_hub', 8, 9, 4, 4,
    '{"title":"Latest Resources","resource_hub_subtitle":"Logos, documents, templates and internal assets.","resource_hub_layout_mode":"list","resource_hub_use_dashboard_mock":false}'::jsonb, 4);
  PERFORM public.marketing_hub_upsert_block(v_page, 'home_timeline', 'content_timeline', 0, 13, 8, 8,
    '{"title":"Content Timeline","content_timeline_preset":"marketing_home","content_timeline_default_view":"month","content_timeline_group_by":"theme","content_timeline_show_filters":true,"content_timeline_enable_detail_panel":true}'::jsonb, 5);
  PERFORM public.marketing_hub_upsert_block(v_page, 'home_events', 'event_calendar', 8, 13, 4, 8,
    '{"title":"Upcoming Events","event_calendar_default_view":"list","event_calendar_show_toolbar":false,"event_calendar_show_metrics":false,"event_calendar_show_filters":false,"event_calendar_density":"compact","appearance":{"showTitle":true}}'::jsonb, 6);
  PERFORM public.marketing_hub_archive_orphan_blocks(v_page, v_keys);

  -- Theme Workspace
  v_page := public.marketing_hub_resolve_page_id(ARRAY['Theme Workspace']);
  v_keys := ARRAY['theme_intro','theme_themes','theme_timeline','theme_actions'];
  PERFORM public.marketing_hub_upsert_block(v_page, 'theme_intro', 'html', 0, 0, 12, 2,
    '{"title":"Theme Workspace intro","html":"<div class=\"px-1 py-2\"><h1 class=\"text-2xl font-bold tracking-tight text-[#111827] md:text-3xl\">Theme Workspace</h1><p class=\"mt-1 text-sm text-[#6B7280]\">Shape quarterly themes, campaign angles and content focus areas.</p></div>"}'::jsonb, 0);
  PERFORM public.marketing_hub_upsert_block(v_page, 'theme_themes', 'content_theme', 0, 2, 12, 8,
    '{"title":"Content Themes","content_theme_year":2026,"content_theme_quarter":"Q2","content_theme_show_filters":true,"content_theme_show_footer":true,"content_theme_highlight_current_quarter":true,"content_theme_view_mode":"grid"}'::jsonb, 1);
  PERFORM public.marketing_hub_upsert_block(v_page, 'theme_timeline', 'content_timeline', 0, 10, 8, 8,
    '{"title":"Theme Timeline","content_timeline_default_view":"quarter","content_timeline_group_by":"theme","content_timeline_show_filters":true}'::jsonb, 2);
  PERFORM public.marketing_hub_upsert_block(v_page, 'theme_actions', 'things_to_do', 8, 10, 4, 8,
    '{"title":"Theme Actions","things_to_do_compact_mode":true,"things_to_do_max_items":5,"things_to_do_show_stats":true}'::jsonb, 3);
  PERFORM public.marketing_hub_archive_orphan_blocks(v_page, v_keys);

  -- Content Planning
  v_page := public.marketing_hub_resolve_page_id(ARRAY['Content Planning']);
  v_keys := ARRAY['planning_intro','planning_todo','planning_timeline','planning_theme_context','planning_social'];
  PERFORM public.marketing_hub_upsert_block(v_page, 'planning_intro', 'html', 0, 0, 12, 2,
    '{"title":"Content Planning intro","html":"<div class=\"px-1 py-2\"><h1 class=\"text-2xl font-bold tracking-tight text-[#111827] md:text-3xl\">Content Planning</h1><p class=\"mt-1 text-sm text-[#6B7280]\">Plan, organise and review upcoming content across channels.</p></div>"}'::jsonb, 0);
  PERFORM public.marketing_hub_upsert_block(v_page, 'planning_todo', 'things_to_do', 0, 2, 4, 6,
    '{"title":"Things To Do","things_to_do_max_items":8,"things_to_do_show_stats":true}'::jsonb, 1);
  PERFORM public.marketing_hub_upsert_block(v_page, 'planning_timeline', 'content_timeline', 4, 2, 8, 8,
    '{"title":"Content Timeline","content_timeline_default_view":"month","content_timeline_group_by":"theme","content_timeline_show_filters":true,"content_timeline_enable_detail_panel":true}'::jsonb, 2);
  PERFORM public.marketing_hub_upsert_block(v_page, 'planning_theme_context', 'content_theme', 0, 8, 4, 6,
    '{"title":"Content Theme Context","content_theme_view_mode":"compact","content_theme_max_themes":4,"content_theme_card_density":"compact"}'::jsonb, 3);
  PERFORM public.marketing_hub_upsert_block(v_page, 'planning_social', 'social_media_calendar', 0, 14, 12, 10,
    '{"title":"Social Media Calendar","social_media_calendar_default_view":"month","social_media_calendar_content_scope":"social_only","social_media_calendar_mode":"full","social_media_calendar_show_status_bar":true,"social_media_calendar_show_filters":true,"social_media_calendar_show_toolbar":true}'::jsonb, 4);
  PERFORM public.marketing_hub_archive_orphan_blocks(v_page, v_keys);

  -- Things To Do
  v_page := public.marketing_hub_resolve_page_id(ARRAY['Things To Do']);
  v_keys := ARRAY['todo_intro','todo_main','todo_timeline','todo_social_preview'];
  PERFORM public.marketing_hub_upsert_block(v_page, 'todo_intro', 'html', 0, 0, 12, 2,
    '{"title":"Things To Do intro","html":"<div class=\"px-1 py-2\"><h1 class=\"text-2xl font-bold tracking-tight text-[#111827] md:text-3xl\">Things To Do</h1><p class=\"mt-1 text-sm text-[#6B7280]\">Track content actions, approvals, missing assets and upcoming deadlines.</p></div>"}'::jsonb, 0);
  PERFORM public.marketing_hub_upsert_block(v_page, 'todo_main', 'things_to_do', 0, 2, 12, 8,
    '{"title":"Things To Do","things_to_do_max_items":12,"things_to_do_show_stats":true,"things_to_do_show_filters":true,"things_to_do_enable_detail_panel":true}'::jsonb, 1);
  PERFORM public.marketing_hub_upsert_block(v_page, 'todo_timeline', 'content_timeline', 0, 10, 8, 8,
    '{"title":"Upcoming Deadlines","content_timeline_default_view":"month","content_timeline_group_by":"status","content_timeline_show_filters":true}'::jsonb, 2);
  PERFORM public.marketing_hub_upsert_block(v_page, 'todo_social_preview', 'social_media_calendar', 8, 10, 4, 8,
    '{"title":"Social Tasks Preview","social_media_calendar_mode":"compact","social_media_calendar_default_view":"list","social_media_calendar_max_posts":5,"social_media_calendar_show_status_bar":true}'::jsonb, 3);
  PERFORM public.marketing_hub_archive_orphan_blocks(v_page, v_keys);

  -- Resource Hub
  v_page := public.marketing_hub_resolve_page_id(ARRAY['Resource Hub', 'Internal Staff Hub']);
  v_keys := ARRAY['resources_intro','resources_hub','resources_actions'];
  PERFORM public.marketing_hub_upsert_block(v_page, 'resources_intro', 'html', 0, 0, 12, 2,
    '{"title":"Resource Hub intro","html":"<div class=\"px-1 py-2\"><h1 class=\"text-2xl font-bold tracking-tight text-[#111827] md:text-3xl\">Resource Hub</h1><p class=\"mt-1 text-sm text-[#6B7280]\">Find logos, documents, media, templates and internal assets.</p></div>"}'::jsonb, 0);
  PERFORM public.marketing_hub_upsert_block(v_page, 'resources_hub', 'internal_resource_hub', 0, 2, 12, 8,
    '{"title":"Internal Resource Hub","resource_hub_layout_mode":"list","resource_hub_use_dashboard_mock":false,"resource_hub_show_search":true,"resource_hub_show_recent":true}'::jsonb, 1);
  PERFORM public.marketing_hub_upsert_block(v_page, 'resources_actions', 'things_to_do', 0, 10, 4, 6,
    '{"title":"Resource Actions","things_to_do_compact_mode":true,"things_to_do_max_items":5,"things_to_do_show_stats":true}'::jsonb, 2);
  PERFORM public.marketing_hub_archive_orphan_blocks(v_page, v_keys);

  -- Social Calendar
  v_page := public.marketing_hub_resolve_page_id(ARRAY['Social Calendar', 'Social Media Calendar']);
  v_keys := ARRAY['social_intro','social_calendar','social_actions','social_timeline'];
  PERFORM public.marketing_hub_upsert_block(v_page, 'social_intro', 'html', 0, 0, 12, 2,
    '{"title":"Social Calendar intro","html":"<div class=\"px-1 py-2\"><h1 class=\"text-2xl font-bold tracking-tight text-[#111827] md:text-3xl\">Social Calendar</h1><p class=\"mt-1 text-sm text-[#6B7280]\">Plan social posts, captions, platforms, creative and approvals.</p></div>"}'::jsonb, 0);
  PERFORM public.marketing_hub_upsert_block(v_page, 'social_calendar', 'social_media_calendar', 0, 2, 12, 10,
    '{"title":"Social Media Calendar","social_media_calendar_default_view":"month","social_media_calendar_content_scope":"social_only","social_media_calendar_mode":"full","social_media_calendar_show_status_bar":true,"social_media_calendar_show_filters":true,"social_media_calendar_show_toolbar":true}'::jsonb, 1);
  PERFORM public.marketing_hub_upsert_block(v_page, 'social_actions', 'things_to_do', 0, 12, 4, 6,
    '{"title":"Social Actions","things_to_do_compact_mode":true,"things_to_do_max_items":6,"things_to_do_show_stats":true}'::jsonb, 2);
  PERFORM public.marketing_hub_upsert_block(v_page, 'social_timeline', 'content_timeline', 4, 12, 8, 6,
    '{"title":"Social Timeline","content_timeline_default_view":"month","content_timeline_group_by":"status","content_timeline_show_filters":true}'::jsonb, 3);
  PERFORM public.marketing_hub_archive_orphan_blocks(v_page, v_keys);

  -- Event Calendar
  v_page := public.marketing_hub_resolve_page_id(ARRAY['Event Calendar']);
  v_keys := ARRAY['events_intro','events_calendar','events_resources','events_actions'];
  PERFORM public.marketing_hub_upsert_block(v_page, 'events_intro', 'html', 0, 0, 12, 2,
    '{"title":"Event Calendar intro","html":"<div class=\"px-1 py-2\"><h1 class=\"text-2xl font-bold tracking-tight text-[#111827] md:text-3xl\">Event Calendar</h1><p class=\"mt-1 text-sm text-[#6B7280]\">Plan events, boat shows, attendance and related marketing activity.</p></div>"}'::jsonb, 0);
  PERFORM public.marketing_hub_upsert_block(v_page, 'events_calendar', 'event_calendar', 0, 2, 12, 10,
    '{"title":"Event Calendar","event_calendar_default_view":"month","event_calendar_show_toolbar":true,"event_calendar_show_metrics":true,"event_calendar_show_filters":true,"event_calendar_show_attendance_controls":true,"event_calendar_show_schedule":true,"event_calendar_show_resources":true}'::jsonb, 1);
  PERFORM public.marketing_hub_upsert_block(v_page, 'events_resources', 'internal_resource_hub', 0, 12, 6, 6,
    '{"title":"Event Resources","resource_hub_layout_mode":"list","resource_hub_use_dashboard_mock":false}'::jsonb, 2);
  PERFORM public.marketing_hub_upsert_block(v_page, 'events_actions', 'things_to_do', 6, 12, 6, 6,
    '{"title":"Event Actions","things_to_do_compact_mode":true,"things_to_do_max_items":5,"things_to_do_show_stats":true}'::jsonb, 3);
  PERFORM public.marketing_hub_archive_orphan_blocks(v_page, v_keys);
END $$;
