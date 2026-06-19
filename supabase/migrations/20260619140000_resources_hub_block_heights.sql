-- Resource Hub bottom row blocks were too short (h=6) and clipped gallery + actions content.

DO $$
DECLARE
  v_page uuid;
BEGIN
  v_page := public.marketing_hub_resolve_page_id(ARRAY['Resource Hub', 'Internal Staff Hub']);

  PERFORM public.marketing_hub_upsert_block(
    v_page,
    'resources_gallery_embed',
    'drive_gallery',
    0, 10, 8, 14,
    jsonb_build_object(
      'title', 'Shared Image Gallery',
      'subtitle', 'Inline view of the shared Google Drive gallery for generic resource images.',
      'drive_folder_id', '1-pHl-DXNlOPC4LuWneYmHB-fzHscofyS'
    ),
    2
  );

  PERFORM public.marketing_hub_upsert_block(
    v_page,
    'resources_actions',
    'things_to_do',
    8, 10, 4, 12,
    '{"title":"Resource Actions","things_to_do_compact_mode":true,"things_to_do_max_items":5,"things_to_do_show_stats":true}'::jsonb,
    3
  );
END $$;
