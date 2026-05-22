-- Point workspace default landing page at Marketing Home (marketing dashboard).
-- Idempotent: safe if function from 20260523000000_marketing_hub_workspace.sql is missing.

DO $$
DECLARE
  v_home_id uuid;
BEGIN
  IF to_regprocedure('public.marketing_hub_resolve_page_id(text[])') IS NOT NULL THEN
    v_home_id := public.marketing_hub_resolve_page_id(ARRAY['Marketing Home', 'Dashboard', 'Marketing Dashboard']);
  ELSE
    SELECT ip.id
    INTO v_home_id
    FROM public.interface_pages ip
    WHERE COALESCE(ip.is_archived, false) = false
      AND (
        ip.config->>'is_home' = 'true'
        OR ip.name IN ('Marketing Home', 'Marketing Dashboard', 'Dashboard')
      )
    ORDER BY
      CASE WHEN ip.config->>'is_home' = 'true' THEN 0 ELSE 1 END,
      ip.order_index ASC NULLS LAST,
      ip.created_at ASC
    LIMIT 1;
  END IF;

  IF v_home_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.workspace_settings
  SET default_interface_id = v_home_id,
      updated_at = now()
  WHERE default_interface_id IS DISTINCT FROM v_home_id
     OR default_interface_id IS NULL;
END $$;
