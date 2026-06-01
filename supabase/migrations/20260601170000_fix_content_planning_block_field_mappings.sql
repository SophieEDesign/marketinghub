-- Content Planning blocks use the Social Posts table. Timeline was mapped to created_at
-- (record import time) instead of publish_date; social calendar scope hid rows without
-- content_type / platform detection.

UPDATE public.view_blocks vb
SET config =
  (vb.config || '{"content_timeline_start_date_field":"publish_date"}'::jsonb)
  - 'content_timeline_start_date_field_id'
FROM public.interface_pages ip
WHERE ip.id = vb.page_id
  AND ip.name = 'Content Planning'
  AND vb.type = 'content_timeline'
  AND vb.config->>'provisioning_key' = 'planning_timeline';

UPDATE public.view_blocks vb
SET config =
  vb.config
  || '{"social_media_calendar_type_field":"post_type","social_media_calendar_publish_date_field":"publish_date"}'::jsonb
FROM public.interface_pages ip
WHERE ip.id = vb.page_id
  AND ip.name = 'Content Planning'
  AND vb.type = 'social_media_calendar'
  AND vb.config->>'provisioning_key' = 'planning_social';
