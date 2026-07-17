-- Replace fragmented HTML/event/resource blocks with a single members_welcome block.

DO $$
DECLARE
  v_page uuid;
  v_keys text[];
BEGIN
  v_page := public.marketing_hub_resolve_page_id(ARRAY['Members Welcome']);
  IF v_page IS NULL THEN
    RAISE NOTICE 'Members Welcome page not found';
    RETURN;
  END IF;

  v_keys := ARRAY['members_welcome_main'];

  PERFORM public.marketing_hub_upsert_block(
    v_page,
    'members_welcome_main',
    'members_welcome',
    0,
    0,
    12,
    22,
    '{
      "title": "Members Welcome",
      "is_full_page": true,
      "members_welcome_max_events": 5,
      "members_welcome_max_resources": 5,
      "members_welcome_allow_submit_event": true,
      "appearance": {"showTitle": false}
    }'::jsonb,
    0
  );

  PERFORM public.marketing_hub_archive_orphan_blocks(v_page, v_keys);
END $$;
