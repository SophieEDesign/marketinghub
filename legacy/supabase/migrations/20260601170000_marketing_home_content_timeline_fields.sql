-- Marketing Home: content timeline field mapping + quarter default view (merge into existing blocks)
DO $$
DECLARE
  v_patch jsonb := jsonb_build_object(
    'content_timeline_use_mock', false,
    'content_timeline_default_view', 'quarter',
    'content_timeline_include_social_posts', true,
    'content_timeline_title_field', 'content_name',
    'content_timeline_theme_field', 'quarterly_theme',
    'content_timeline_type_field', 'content_type',
    'content_timeline_status_field', 'status',
    'content_timeline_channel_field', 'channels',
    'content_timeline_owner_field', 'owner',
    'content_timeline_start_date_field', 'date',
    'content_timeline_end_date_field', 'date_due',
    'content_timeline_date_to_field', 'date_to',
    'content_timeline_division_field', 'division'
  );
BEGIN
  UPDATE public.view_blocks vb
  SET config = COALESCE(vb.config, '{}'::jsonb) || v_patch
  WHERE COALESCE(vb.is_archived, false) = false
    AND vb.type = 'content_timeline'
    AND vb.config->>'provisioning_key' = 'home_timeline';
END $$;
