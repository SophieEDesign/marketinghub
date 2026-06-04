-- Members Welcome: member-facing home page (Interface Builder canvas).
-- Idempotent; uses marketing_hub_* helpers from 20260523000000_marketing_hub_workspace.sql

-- Create page when missing (visible to members, not admin-only)
INSERT INTO public.interface_pages (
  name, page_type, group_id, order_index, config, saved_view_id,
  dashboard_layout_id, form_config_id, record_config_id,
  is_admin_only, is_hidden, is_archived
)
SELECT
  'Members Welcome',
  'content',
  src.group_id,
  0,
  '{}'::jsonb,
  src.saved_view_id,
  NULL, NULL, NULL,
  false, false, false
FROM public.interface_pages src
WHERE COALESCE(src.is_archived, false) = false
  AND src.name = 'Content Planning'
  AND NOT EXISTS (
    SELECT 1 FROM public.interface_pages ip
    WHERE ip.name = 'Members Welcome' AND COALESCE(ip.is_archived, false) = false
  )
LIMIT 1;

-- Ensure existing page is visible
UPDATE public.interface_pages
SET
  is_admin_only = false,
  is_hidden = false,
  is_archived = false,
  config = COALESCE(config, '{}'::jsonb) - 'layout_style'
WHERE COALESCE(is_archived, false) = false
  AND name = 'Members Welcome';

-- Blocks + sidebar order
DO $$
DECLARE
  v_page uuid;
  v_keys text[];
  v_event uuid;
  v_resource uuid;
  v_contacts uuid;
  v_help uuid;
  v_event_href text := '';
  v_resource_href text := '';
  v_contacts_href text := '';
  v_help_href text := '';
  v_quick_html text;
  v_guidance_html text;
BEGIN
  v_page := public.marketing_hub_resolve_page_id(ARRAY['Members Welcome']);
  IF v_page IS NULL THEN
    RAISE NOTICE 'Members Welcome page not found — skipping block sync';
    RETURN;
  END IF;

  v_event := public.marketing_hub_resolve_page_id(ARRAY['Event Calendar', 'Events Calendar']);
  v_resource := public.marketing_hub_resolve_page_id(ARRAY['Resource Hub', 'Internal Staff Hub']);
  v_contacts := public.marketing_hub_resolve_page_id(ARRAY['Contacts']);
  v_help := public.marketing_hub_resolve_page_id(ARRAY['Help & Guidance', 'Help and Guidance', 'Help']);

  IF v_event IS NOT NULL THEN
    v_event_href := '/pages/' || v_event::text;
  END IF;
  IF v_resource IS NOT NULL THEN
    v_resource_href := '/pages/' || v_resource::text;
  END IF;
  IF v_contacts IS NOT NULL THEN
    v_contacts_href := '/pages/' || v_contacts::text;
  END IF;
  IF v_help IS NOT NULL THEN
    v_help_href := '/pages/' || v_help::text;
  END IF;

  v_quick_html :=
    '<section class="rounded-2xl border border-[#E6E6EF] bg-[#FAF9FF] p-4 md:p-5">'
    || '<div class="mb-4"><h2 class="text-lg font-semibold text-[#111827]">Quick actions</h2>'
    || '<p class="mt-1 text-sm text-[#6B7280]">Open the areas you can use most often.</p></div>'
    || '<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">';

  IF v_event_href <> '' THEN
    v_quick_html := v_quick_html
      || '<article class="rounded-2xl border border-[#E6E6EF] bg-white p-5 shadow-sm"><h3 class="text-base font-semibold text-[#111827]">View Events</h3>'
      || '<p class="mt-2 text-sm text-[#6B7280]">See upcoming boat shows, industry events and member activities.</p>'
      || '<a href="' || v_event_href || '" class="mt-4 inline-flex text-sm font-semibold text-[#5B3DF5]">Open event calendar →</a></article>'
      || '<article class="rounded-2xl border border-[#E6E6EF] bg-white p-5 shadow-sm"><h3 class="text-base font-semibold text-[#111827]">My Attendance</h3>'
      || '<p class="mt-2 text-sm text-[#6B7280]">Check which events you are attending and update your response.</p>'
      || '<a href="' || v_event_href || '" class="mt-4 inline-flex text-sm font-semibold text-[#5B3DF5]">View my events →</a></article>';
  END IF;

  IF v_resource_href <> '' THEN
    v_quick_html := v_quick_html
      || '<article class="rounded-2xl border border-[#E6E6EF] bg-white p-5 shadow-sm"><h3 class="text-base font-semibold text-[#111827]">Resource Hub</h3>'
      || '<p class="mt-2 text-sm text-[#6B7280]">Access approved logos, presentations, documents and shared media.</p>'
      || '<a href="' || v_resource_href || '" class="mt-4 inline-flex text-sm font-semibold text-[#5B3DF5]">Open resources →</a></article>';
  END IF;

  IF v_event_href <> '' THEN
    v_quick_html := v_quick_html
      || '<article class="rounded-2xl border border-[#E6E6EF] bg-white p-5 shadow-sm"><h3 class="text-base font-semibold text-[#111827]">Submit an Event</h3>'
      || '<p class="mt-2 text-sm text-[#6B7280]">Suggest an event for review by the Peters &amp; May team.</p>'
      || '<a href="' || v_event_href || '" class="mt-4 inline-flex text-sm font-semibold text-[#5B3DF5]">Submit event →</a></article>';
  END IF;

  IF v_contacts_href <> '' THEN
    v_quick_html := v_quick_html
      || '<article class="rounded-2xl border border-[#E6E6EF] bg-white p-5 shadow-sm"><h3 class="text-base font-semibold text-[#111827]">Useful Contacts</h3>'
      || '<p class="mt-2 text-sm text-[#6B7280]">Find relevant Peters &amp; May contacts for events and collaboration.</p>'
      || '<a href="' || v_contacts_href || '" class="mt-4 inline-flex text-sm font-semibold text-[#5B3DF5]">View contacts →</a></article>';
  END IF;

  IF v_help_href <> '' THEN
    v_quick_html := v_quick_html
      || '<article class="rounded-2xl border border-[#E6E6EF] bg-white p-5 shadow-sm"><h3 class="text-base font-semibold text-[#111827]">Help &amp; Guidance</h3>'
      || '<p class="mt-2 text-sm text-[#6B7280]">Learn how to use the hub or contact the team for support.</p>'
      || '<a href="' || v_help_href || '" class="mt-4 inline-flex text-sm font-semibold text-[#5B3DF5]">Get help →</a></article>';
  END IF;

  v_quick_html := v_quick_html || '</div></section>';

  v_guidance_html :=
    '<section class="rounded-2xl border border-[#E6E6EF] bg-white p-6"><h2 class="text-lg font-semibold text-[#111827]">How to use this space</h2>'
    || '<p class="mt-2 text-sm text-[#6B7280]">Use the Events area to view upcoming activity and update your attendance. '
    || 'Use the Resource Hub to access approved documents and shared media. If you need help, contact the Peters &amp; May team.</p>';

  IF v_help_href <> '' THEN
    v_guidance_html := v_guidance_html
      || '<a href="' || v_help_href || '" class="mt-4 inline-flex items-center rounded-lg bg-[#5B3DF5] px-4 py-2 text-sm font-semibold text-white">Contact support</a>';
  END IF;

  v_guidance_html := v_guidance_html || '</section>';

  v_keys := ARRAY[
    'members_welcome_hero',
    'members_welcome_quick_actions',
    'members_welcome_events',
    'members_welcome_resources',
    'members_welcome_guidance'
  ];

  PERFORM public.marketing_hub_upsert_block(
    v_page, 'members_welcome_hero', 'html', 0, 0, 12, 4,
    jsonb_build_object(
      'title', 'Members Welcome Hero',
      'html',
      '<section class="rounded-2xl border border-[#E6E6EF] bg-[#F7F4FF] p-6 md:p-8">'
        || '<h1 class="text-2xl font-bold tracking-tight text-[#111827] md:text-3xl">Welcome to the Peters &amp; May Marketing Hub</h1>'
        || '<p class="mt-2 text-sm text-[#374151] md:text-base">Access shared events, useful resources and collaboration tools in one place.</p>'
        || '<p class="mt-3 text-sm text-[#6B7280]">Use this space to view upcoming events, manage your attendance, access approved documents and stay aligned with relevant activity.</p>'
      || '</section>'
    ),
    0
  );

  PERFORM public.marketing_hub_upsert_block(
    v_page, 'members_welcome_quick_actions', 'html', 0, 4, 12, 6,
    jsonb_build_object('title', 'Members Quick Actions', 'html', v_quick_html),
    1
  );

  PERFORM public.marketing_hub_upsert_block(
    v_page, 'members_welcome_events', 'event_calendar', 0, 10, 6, 8,
    '{
      "title": "Upcoming events",
      "subtitle": "Your next 5 visible events",
      "event_calendar_external_mode": true,
      "event_calendar_default_view": "list",
      "event_calendar_mobile_default_view": "list",
      "event_calendar_max_items": 5,
      "event_calendar_show_toolbar": false,
      "event_calendar_show_metrics": false,
      "event_calendar_show_stats": false,
      "event_calendar_show_filters": false,
      "event_calendar_show_search": false,
      "event_calendar_show_actions": false,
      "event_calendar_show_add_button": false,
      "event_calendar_show_attendance_controls": true,
      "event_calendar_allow_attendance_updates": true,
      "event_calendar_allow_member_submissions": true,
      "event_calendar_density": "compact",
      "appearance": {"showTitle": true}
    }'::jsonb,
    2
  );

  PERFORM public.marketing_hub_upsert_block(
    v_page, 'members_welcome_resources', 'internal_resource_hub', 6, 10, 6, 8,
    '{
      "title": "Featured resources",
      "subtitle": "Approved files and guidance for members",
      "resource_hub_subtitle": "Recently added and important resources",
      "resource_hub_layout_mode": "list",
      "resource_hub_show_search": false,
      "resource_hub_show_filters": false,
      "resource_hub_show_recent": false,
      "resource_hub_show_upload": false,
      "resource_hub_show_detail_panel": false,
      "resource_hub_max_items": 5,
      "record_limit": 5,
      "appearance": {"showTitle": true}
    }'::jsonb,
    3
  );

  PERFORM public.marketing_hub_upsert_block(
    v_page, 'members_welcome_guidance', 'html', 0, 18, 12, 3,
    jsonb_build_object('title', 'Members Guidance', 'html', v_guidance_html),
    4
  );

  PERFORM public.marketing_hub_archive_orphan_blocks(v_page, v_keys);
END $$;

-- Sidebar: Members Welcome first, then existing hub pages
DO $$
DECLARE
  r RECORD;
  idx integer := 0;
BEGIN
  FOR r IN
    SELECT unnest(ARRAY[
      'Members Welcome',
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

-- Optional: point member default landing at Members Welcome when not yet configured
UPDATE public.workspace_settings
SET member_default_interface_id = public.marketing_hub_resolve_page_id(ARRAY['Members Welcome'])
WHERE member_default_interface_id IS NULL
  AND public.marketing_hub_resolve_page_id(ARRAY['Members Welcome']) IS NOT NULL;
