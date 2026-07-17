-- field/grid: canonicalize heightMode -> height_mode without overwriting existing height_mode.
UPDATE public.view_blocks
SET config =
  jsonb_strip_nulls(
    (config - 'heightMode') ||
    jsonb_build_object('height_mode', COALESCE(config->'height_mode', config->'heightMode'))
  )
WHERE type IN ('field', 'grid')
  AND config ? 'heightMode';
