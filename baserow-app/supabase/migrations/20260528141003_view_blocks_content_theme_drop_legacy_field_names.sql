-- content_theme: remove legacy *_field name keys when corresponding *_field_id UUID exists.
UPDATE public.view_blocks
SET config = config
  - 'content_theme_name_field'
  - 'content_theme_quarter_field'
  - 'content_theme_year_field'
  - 'content_theme_colour_field'
  - 'content_theme_divisions_field'
WHERE type = 'content_theme'
  AND (
    ((config->>'content_theme_name_field_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND config ? 'content_theme_name_field')
    OR ((config->>'content_theme_quarter_field_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND config ? 'content_theme_quarter_field')
    OR ((config->>'content_theme_year_field_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND config ? 'content_theme_year_field')
    OR ((config->>'content_theme_colour_field_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND config ? 'content_theme_colour_field')
    OR ((config->>'content_theme_divisions_field_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND config ? 'content_theme_divisions_field')
  );
