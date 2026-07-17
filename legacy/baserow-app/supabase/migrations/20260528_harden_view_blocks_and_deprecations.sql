-- Marketing Hub hardening migration:
-- 1) enforce view_blocks anchor contract
-- 2) normalize block config keys to snake_case
-- 3) remove deprecated table references from block configs
-- 4) drop known-empty legacy physical tables
-- 5) deprecate legacy user_roles table access

-- 1) Every view_blocks row must be anchored to a page or view.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'view_blocks'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'view_blocks_anchor_required_chk'
    ) THEN
      ALTER TABLE public.view_blocks
        ADD CONSTRAINT view_blocks_anchor_required_chk
        CHECK (page_id IS NOT NULL OR view_id IS NOT NULL);
    END IF;
  END IF;
END $$;

-- 2) Canonicalize common camelCase config keys in view_blocks.config.
UPDATE public.view_blocks
SET config =
  jsonb_strip_nulls(
    (config - 'tableId' - 'viewId' - 'sourceTableId' - 'sourceViewId') ||
    jsonb_build_object(
      'table_id', COALESCE(config->'table_id', config->'tableId', config->'sourceTableId'),
      'view_id', COALESCE(config->'view_id', config->'viewId', config->'sourceViewId')
    )
  )
WHERE config ? 'tableId'
   OR config ? 'viewId'
   OR config ? 'sourceTableId'
   OR config ? 'sourceViewId';

-- 3) Remove references to deprecated table registry IDs from view_blocks.config.
WITH deprecated_table_ids AS (
  SELECT id::text AS table_id
  FROM public.tables
  WHERE supabase_table IN (
    'table_briefings_1766847886126',
    'table_campaigns_1766847958019',
    'table_contacts_1766847128905',
    'table_content_1767726395418',
    'table_sponsorships_1766847842576'
  )
)
UPDATE public.view_blocks vb
SET config = (vb.config - 'table_id' - 'tableId')
FROM deprecated_table_ids d
WHERE (vb.config->>'table_id' = d.table_id OR vb.config->>'tableId' = d.table_id);

-- 4) Drop known-empty legacy physical tables.
DROP TABLE IF EXISTS public.table_briefings_1766847886126;
DROP TABLE IF EXISTS public.table_campaigns_1766847958019;
DROP TABLE IF EXISTS public.table_contacts_1766847128905;
DROP TABLE IF EXISTS public.table_content_1767726395418;
DROP TABLE IF EXISTS public.table_sponsorships_1766847842576;

-- 5) Deprecate legacy user_roles table access in favor of profiles.role.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_roles'
  ) THEN
    REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_roles FROM anon, authenticated;
    COMMENT ON TABLE public.user_roles IS 'DEPRECATED: use public.profiles.role (admin/member) for authorization checks and RLS.';
  END IF;
END $$;

