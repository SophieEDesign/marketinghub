-- Ensure Event Calendar is visible to member role users (alongside other marketing pages)

UPDATE public.interface_pages
SET
  is_admin_only = false,
  is_hidden = false
WHERE COALESCE(is_archived, false) = false
  AND name IN (
    'Event Calendar',
    'Internal Staff Hub',
    'Dashboard',
    'Marketing Home',
    'Marketing Dashboard',
    'Theme Workspace',
    'Content Planning',
    'Social Media Calendar'
  );

UPDATE public.interface_pages
SET config = COALESCE(config, '{}'::jsonb) || '{"layout_style":"event_calendar"}'::jsonb
WHERE COALESCE(is_archived, false) = false
  AND name = 'Event Calendar';
