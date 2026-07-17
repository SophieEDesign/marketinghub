-- Ensure marketing hub pages (including Internal Staff Hub) are visible to member role users.
-- Admins can still restrict via page settings; this migration fixes drift from defaults (is_admin_only true).

UPDATE public.interface_pages
SET
  is_admin_only = false,
  is_hidden = false
WHERE COALESCE(is_archived, false) = false
  AND name IN (
    'Internal Staff Hub',
    'Dashboard',
    'Marketing Home',
    'Marketing Dashboard',
    'Theme Workspace',
    'Content Planning'
  );

UPDATE public.interface_pages
SET config = COALESCE(config, '{}'::jsonb) || '{"layout_style":"internal_staff_hub"}'::jsonb
WHERE COALESCE(is_archived, false) = false
  AND name = 'Internal Staff Hub';

UPDATE public.interface_pages
SET config = COALESCE(config, '{}'::jsonb) || '{"layout_style":"marketing_home"}'::jsonb
WHERE COALESCE(is_archived, false) = false
  AND name IN ('Dashboard', 'Marketing Home', 'Marketing Dashboard');

UPDATE public.interface_pages
SET config = COALESCE(config, '{}'::jsonb) || '{"layout_style":"theme_overview"}'::jsonb
WHERE COALESCE(is_archived, false) = false
  AND name = 'Theme Workspace';

UPDATE public.interface_pages
SET config = COALESCE(config, '{}'::jsonb) || '{"layout_style":"content_planning"}'::jsonb
WHERE COALESCE(is_archived, false) = false
  AND name = 'Content Planning';
