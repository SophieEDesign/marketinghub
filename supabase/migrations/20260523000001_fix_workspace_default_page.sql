-- Repoint workspace/user default page IDs when they reference archived or missing pages.
-- Fixes 500s / blank home after marketing_hub_workspace archives duplicate "Marketing Home" rows.

-- Workspace default → active Marketing Home
UPDATE public.workspace_settings ws
SET
  default_interface_id = sub.id,
  updated_at = now()
FROM (
  SELECT ip.id
  FROM public.interface_pages ip
  WHERE COALESCE(ip.is_archived, false) = false
    AND ip.name = 'Marketing Home'
  ORDER BY
    (
      SELECT COUNT(*)
      FROM public.view_blocks vb
      WHERE vb.page_id = ip.id
        AND COALESCE(vb.is_archived, false) = false
    ) DESC,
    ip.created_at ASC
  LIMIT 1
) sub
WHERE sub.id IS NOT NULL
  AND (
    ws.default_interface_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.interface_pages ip
      WHERE ip.id = ws.default_interface_id
        AND COALESCE(ip.is_archived, false) = false
    )
  );

-- User profile default (when column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'default_page_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.profiles p
      SET default_page_id = sub.id
      FROM (
        SELECT ip.id
        FROM public.interface_pages ip
        WHERE COALESCE(ip.is_archived, false) = false
          AND ip.name = 'Marketing Home'
        ORDER BY ip.created_at ASC
        LIMIT 1
      ) sub
      WHERE sub.id IS NOT NULL
        AND p.default_page_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.interface_pages ip
          WHERE ip.id = p.default_page_id
            AND COALESCE(ip.is_archived, false) = false
        )
    $sql$;
  END IF;
END $$;
