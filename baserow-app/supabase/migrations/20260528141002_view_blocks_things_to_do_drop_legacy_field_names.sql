-- things_to_do: remove legacy *_field name keys when corresponding *_field_id UUID exists.
UPDATE public.view_blocks
SET config = config
  - 'things_to_do_title_field'
  - 'things_to_do_type_field'
  - 'things_to_do_status_field'
  - 'things_to_do_priority_field'
  - 'things_to_do_owner_field'
  - 'things_to_do_reviewer_field'
  - 'things_to_do_due_date_field'
  - 'things_to_do_campaign_field'
  - 'things_to_do_theme_field'
WHERE type = 'things_to_do'
  AND (
    ((config->>'things_to_do_title_field_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND config ? 'things_to_do_title_field')
    OR ((config->>'things_to_do_type_field_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND config ? 'things_to_do_type_field')
    OR ((config->>'things_to_do_status_field_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND config ? 'things_to_do_status_field')
    OR ((config->>'things_to_do_priority_field_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND config ? 'things_to_do_priority_field')
    OR ((config->>'things_to_do_owner_field_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND config ? 'things_to_do_owner_field')
    OR ((config->>'things_to_do_reviewer_field_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND config ? 'things_to_do_reviewer_field')
    OR ((config->>'things_to_do_due_date_field_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND config ? 'things_to_do_due_date_field')
    OR ((config->>'things_to_do_campaign_field_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND config ? 'things_to_do_campaign_field')
    OR ((config->>'things_to_do_theme_field_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND config ? 'things_to_do_theme_field')
  );
