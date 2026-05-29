-- Canonicalize campaigns_overview block config keys (block generic settings contract).

UPDATE public.view_blocks vb
SET config =
  (
    vb.config
    || jsonb_build_object(
      'subtitle', COALESCE(vb.config->>'subtitle', vb.config->>'campaigns_subtitle'),
      'campaigns_title_field_id', COALESCE(vb.config->>'campaigns_title_field_id', vb.config->>'title_field_id'),
      'campaigns_title_field', COALESCE(vb.config->>'campaigns_title_field', vb.config->>'title_field'),
      'campaigns_type_field_id', COALESCE(vb.config->>'campaigns_type_field_id', vb.config->>'type_field_id'),
      'campaigns_type_field', COALESCE(vb.config->>'campaigns_type_field', vb.config->>'type_field'),
      'campaigns_division_field_id', COALESCE(vb.config->>'campaigns_division_field_id', vb.config->>'division_field_id'),
      'campaigns_division_field', COALESCE(vb.config->>'campaigns_division_field', vb.config->>'division_field'),
      'campaigns_status_field_id', COALESCE(vb.config->>'campaigns_status_field_id', vb.config->>'status_field_id'),
      'campaigns_status_field', COALESCE(vb.config->>'campaigns_status_field', vb.config->>'status_field'),
      'campaigns_priority_field_id', COALESCE(vb.config->>'campaigns_priority_field_id', vb.config->>'priority_field_id'),
      'campaigns_priority_field', COALESCE(vb.config->>'campaigns_priority_field', vb.config->>'priority_field'),
      'campaigns_stage_field_id', COALESCE(vb.config->>'campaigns_stage_field_id', vb.config->>'stage_field_id'),
      'campaigns_stage_field', COALESCE(vb.config->>'campaigns_stage_field', vb.config->>'stage_field'),
      'campaigns_start_date_field_id', COALESCE(vb.config->>'campaigns_start_date_field_id', vb.config->>'start_date_field_id'),
      'campaigns_start_date_field', COALESCE(vb.config->>'campaigns_start_date_field', vb.config->>'start_date_field'),
      'campaigns_end_date_field_id', COALESCE(vb.config->>'campaigns_end_date_field_id', vb.config->>'end_date_field_id'),
      'campaigns_end_date_field', COALESCE(vb.config->>'campaigns_end_date_field', vb.config->>'end_date_field'),
      'campaigns_owner_field_id', COALESCE(vb.config->>'campaigns_owner_field_id', vb.config->>'owner_field_id'),
      'campaigns_owner_field', COALESCE(vb.config->>'campaigns_owner_field', vb.config->>'owner_field'),
      'campaigns_progress_field_id', COALESCE(vb.config->>'campaigns_progress_field_id', vb.config->>'progress_field_id'),
      'campaigns_progress_field', COALESCE(vb.config->>'campaigns_progress_field', vb.config->>'progress_field'),
      'campaigns_image_field_id', COALESCE(vb.config->>'campaigns_image_field_id', vb.config->>'image_field_id'),
      'campaigns_image_field', COALESCE(vb.config->>'campaigns_image_field', vb.config->>'image_field'),
      'campaigns_linked_content_field_id', COALESCE(vb.config->>'campaigns_linked_content_field_id', vb.config->>'linked_content_field_id'),
      'campaigns_linked_content_field', COALESCE(vb.config->>'campaigns_linked_content_field', vb.config->>'linked_content_field'),
      'campaigns_linked_tasks_field_id', COALESCE(vb.config->>'campaigns_linked_tasks_field_id', vb.config->>'linked_tasks_field_id'),
      'campaigns_linked_tasks_field', COALESCE(vb.config->>'campaigns_linked_tasks_field', vb.config->>'linked_tasks_field'),
      'campaigns_linked_events_field_id', COALESCE(vb.config->>'campaigns_linked_events_field_id', vb.config->>'linked_events_field_id'),
      'campaigns_linked_events_field', COALESCE(vb.config->>'campaigns_linked_events_field', vb.config->>'linked_events_field'),
      'campaigns_click_action', COALESCE(vb.config->>'campaigns_click_action', vb.config->>'click_action', 'open_record'),
      'campaigns_open_record_mode', COALESCE(vb.config->>'campaigns_open_record_mode', vb.config->>'open_record_mode', 'modal')
    )
  )
  - 'campaigns_subtitle'
  - 'title_field_id'
  - 'title_field'
  - 'type_field_id'
  - 'type_field'
  - 'division_field_id'
  - 'division_field'
  - 'status_field_id'
  - 'status_field'
  - 'priority_field_id'
  - 'priority_field'
  - 'stage_field_id'
  - 'stage_field'
  - 'start_date_field_id'
  - 'start_date_field'
  - 'end_date_field_id'
  - 'end_date_field'
  - 'owner_field_id'
  - 'owner_field'
  - 'progress_field_id'
  - 'progress_field'
  - 'image_field_id'
  - 'image_field'
  - 'linked_content_field_id'
  - 'linked_content_field'
  - 'linked_tasks_field_id'
  - 'linked_tasks_field'
  - 'linked_events_field_id'
  - 'linked_events_field'
  - 'click_action'
  - 'open_record_mode'
WHERE vb.type = 'campaigns_overview'
  AND COALESCE(vb.is_archived, false) = false;
