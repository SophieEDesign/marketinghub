-- record_context: remove camelCase keys only when snake_case equivalents exist.
UPDATE public.view_blocks
SET config =
  (CASE WHEN (config ? 'display_mode' AND config ? 'displayMode') THEN config - 'displayMode' ELSE config END)
  - (CASE WHEN (config ? 'allow_clear' AND config ? 'allowClear') THEN 'allowClear' ELSE '__skip_allow_clear__' END)
  - (CASE WHEN (config ? 'selection_mode' AND config ? 'selectionMode') THEN 'selectionMode' ELSE '__skip_selection_mode__' END)
WHERE type = 'record_context'
  AND (
    (config ? 'display_mode' AND config ? 'displayMode')
    OR (config ? 'allow_clear' AND config ? 'allowClear')
    OR (config ? 'selection_mode' AND config ? 'selectionMode')
  );
