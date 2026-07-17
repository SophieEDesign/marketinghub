-- Restore admin-only flags for marketing planning pages.
-- Sidebar order migrations (e.g. members welcome) incorrectly set is_admin_only = false on all hub pages,
-- which breaks member preview and member-role navigation filtering.

UPDATE public.interface_pages
SET is_admin_only = true, updated_at = now()
WHERE COALESCE(is_archived, false) = false
  AND name IN (
    'Marketing Home',
    'Marketing Dashboard',
    'Dashboard',
    'Theme Workspace',
    'Campaigns',
    'Content Planning',
    'Things To Do'
  );

UPDATE public.interface_pages
SET is_admin_only = false, is_hidden = false, updated_at = now()
WHERE COALESCE(is_archived, false) = false
  AND name IN (
    'Members Welcome',
    'Resource Hub',
    'Internal Staff Hub',
    'Internal Marketing Hub',
    'Social Calendar',
    'Social Media Calendar',
    'Social Media',
    'Event Calendar',
    'Events Calendar'
  );

-- Ensure member landing points at Members Welcome when available.
UPDATE public.workspace_settings
SET member_default_interface_id = public.marketing_hub_resolve_page_id(ARRAY['Members Welcome'])
WHERE public.marketing_hub_resolve_page_id(ARRAY['Members Welcome']) IS NOT NULL;
