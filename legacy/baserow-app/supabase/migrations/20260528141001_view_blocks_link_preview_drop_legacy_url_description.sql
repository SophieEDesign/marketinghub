-- link_preview: remove legacy url/description when canonical link_url exists.
UPDATE public.view_blocks
SET config = config - 'url' - 'description'
WHERE type = 'link_preview'
  AND config ? 'link_url'
  AND (config ? 'url' OR config ? 'description');
