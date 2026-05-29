-- Campaigns overview Interface page + campaigns_overview block.
-- Idempotent; complements baserow-app/scripts/apply-marketing-hub-workspace.cjs

-- Create Campaigns page when missing (anchor to Campaigns table view when available)
INSERT INTO public.interface_pages (
  name, page_type, group_id, order_index, config, saved_view_id,
  dashboard_layout_id, form_config_id, record_config_id,
  is_admin_only, is_hidden, is_archived
)
SELECT
  'Campaigns',
  'content',
  src.group_id,
  2,
  '{}'::jsonb,
  COALESCE(
    (
      SELECT v.id
      FROM public.views v
      INNER JOIN public.tables t ON t.id = v.table_id
      WHERE t.name ILIKE '%campaign%'
        AND t.name NOT ILIKE '%content%'
      ORDER BY v.created_at ASC
      LIMIT 1
    ),
    src.saved_view_id
  ),
  NULL, NULL, NULL,
  false, false, false
FROM public.interface_pages src
WHERE COALESCE(src.is_archived, false) = false
  AND src.name = 'Theme Workspace'
  AND NOT EXISTS (
    SELECT 1
    FROM public.interface_pages ip
    WHERE ip.name = 'Campaigns'
      AND COALESCE(ip.is_archived, false) = false
  )
LIMIT 1;

-- Ensure Campaigns sits in the same sidebar group as Theme Workspace (Public)
UPDATE public.interface_pages campaigns
SET group_id = src.group_id
FROM public.interface_pages src
WHERE COALESCE(campaigns.is_archived, false) = false
  AND campaigns.name = 'Campaigns'
  AND COALESCE(src.is_archived, false) = false
  AND src.name = 'Theme Workspace';

-- Existing Campaigns pages may be record_view; blocks only render on content pages.
UPDATE public.interface_pages
SET
  page_type = 'content',
  config = '{}'::jsonb,
  is_hidden = false,
  is_admin_only = false
WHERE name = 'Campaigns'
  AND COALESCE(is_archived, false) = false
  AND page_type IS DISTINCT FROM 'content';

-- Sidebar order: Campaigns after Theme Workspace
DO $$
DECLARE
  r RECORD;
  idx integer := 0;
BEGIN
  FOR r IN
    SELECT unnest(ARRAY[
      'Marketing Home',
      'Theme Workspace',
      'Campaigns',
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

-- Block layout
DO $$
DECLARE
  v_page uuid;
  v_keys text[];
  v_table_id uuid;
  v_config jsonb;
BEGIN
  v_page := public.marketing_hub_resolve_page_id(ARRAY['Campaigns']);
  IF v_page IS NULL THEN
    RETURN;
  END IF;

  SELECT t.id
  INTO v_table_id
  FROM public.tables t
  WHERE t.name ILIKE '%campaign%'
    AND t.name NOT ILIKE '%content%'
  ORDER BY t.created_at ASC
  LIMIT 1;

  v_config := jsonb_build_object(
    'title', 'Campaigns',
    'subtitle', 'Plan, manage and track all marketing campaigns.',
    'campaigns_default_view', 'list',
    'campaigns_show_search', true,
    'campaigns_show_filters', true,
    'campaigns_show_kpis', true,
    'campaigns_show_progress', true,
    'campaigns_show_thumbnails', true,
    'campaigns_density', 'comfortable',
    'campaigns_max_items', 200,
    'campaigns_click_action', 'open_record',
    'campaigns_open_record_mode', 'modal',
    'appearance', jsonb_build_object('showTitle', true)
  );

  IF v_table_id IS NOT NULL THEN
    v_config := v_config || jsonb_build_object('table_id', v_table_id::text);
  END IF;

  v_keys := ARRAY['campaigns_intro', 'campaigns_overview_main'];

  PERFORM public.marketing_hub_upsert_block(
    v_page, 'campaigns_intro', 'html', 0, 0, 12, 2,
    '{"title":"Campaigns intro","html":"<div class=\"px-1 py-2\"><h1 class=\"text-2xl font-bold tracking-tight text-[#111827] md:text-3xl\">Campaigns</h1><p class=\"mt-1 text-sm text-[#6B7280]\">Plan, manage and track all marketing campaigns.</p></div>"}'::jsonb,
    0
  );

  PERFORM public.marketing_hub_upsert_block(
    v_page, 'campaigns_overview_main', 'campaigns_overview', 0, 2, 12, 14,
    v_config,
    1
  );

  PERFORM public.marketing_hub_archive_orphan_blocks(v_page, v_keys);
END $$;
