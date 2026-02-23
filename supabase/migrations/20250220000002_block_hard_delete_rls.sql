-- Migration: Block hard DELETE via RLS - enforce soft delete only
--
-- Prevents accidental permanent data loss. App must use soft delete
-- (UPDATE is_archived/deleted_at) instead of DELETE.
--
-- Tables: view_blocks, interface_pages, views, interface_groups, dynamic record tables (table_*)

-- ============================================================================
-- view_blocks: Drop DELETE policies, add blocking policy
-- ============================================================================

DROP POLICY IF EXISTS "Users can delete blocks for accessible views" ON public.view_blocks;
DROP POLICY IF EXISTS "Users can delete blocks for accessible pages" ON public.view_blocks;
DROP POLICY IF EXISTS "Admins can delete all blocks" ON public.view_blocks;

CREATE POLICY "block_hard_delete_view_blocks"
  ON public.view_blocks FOR DELETE
  TO authenticated
  USING (false);

-- ============================================================================
-- interface_pages: Drop DELETE policies, add blocking policy
-- ============================================================================

DROP POLICY IF EXISTS "Allow users to delete their own interface pages" ON public.interface_pages;
DROP POLICY IF EXISTS "Allow admins to delete any interface page" ON public.interface_pages;
DROP POLICY IF EXISTS "Allow authenticated users to delete interface pages" ON public.interface_pages;

CREATE POLICY "block_hard_delete_interface_pages"
  ON public.interface_pages FOR DELETE
  TO authenticated
  USING (false);

-- ============================================================================
-- views: Drop DELETE policies, add blocking policy
-- ============================================================================

DROP POLICY IF EXISTS "Users can delete interface pages" ON public.views;
DROP POLICY IF EXISTS "Users can delete views via table access" ON public.views;
DROP POLICY IF EXISTS "Admins can delete any view" ON public.views;

CREATE POLICY "block_hard_delete_views"
  ON public.views FOR DELETE
  TO authenticated
  USING (false);

-- ============================================================================
-- interface_groups: Drop DELETE policy, add blocking policy
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated users to delete interface groups" ON public.interface_groups;

CREATE POLICY "block_hard_delete_interface_groups"
  ON public.interface_groups FOR DELETE
  TO authenticated
  USING (false);

-- ============================================================================
-- Dynamic record tables (table_*): Add blocking DELETE policy
-- Existing "Authenticated users can access data" FOR ALL includes DELETE.
-- We drop it and recreate without DELETE, or add a blocking policy.
-- With RLS, multiple policies OR together - so we need to remove the
-- permissive DELETE. We drop the FOR ALL policy and create SELECT/INSERT/UPDATE
-- only, plus block DELETE.
-- ============================================================================

DO $$
DECLARE
  r record;
  has_for_all boolean;
BEGIN
  FOR r IN
    SELECT DISTINCT table_name
    FROM (
      SELECT btrim(t.supabase_table) AS table_name
      FROM public.tables t
      WHERE t.supabase_table IS NOT NULL
        AND btrim(t.supabase_table) <> ''
      UNION
      SELECT it.table_name
      FROM information_schema.tables it
      WHERE it.table_schema = 'public'
        AND it.table_name LIKE 'table\_%' ESCAPE '\'
    ) s
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables it2
      WHERE it2.table_schema = 'public' AND it2.table_name = r.table_name
    ) THEN
      -- Drop the permissive FOR ALL policy if it exists
      EXECUTE format(
        'DROP POLICY IF EXISTS "Authenticated users can access data" ON public.%I;',
        r.table_name
      );

      -- Recreate SELECT, INSERT, UPDATE (no DELETE)
      EXECUTE format(
        'CREATE POLICY "Authenticated users can access data" ON public.%I
         FOR ALL TO authenticated
         USING (auth.role() = ''authenticated'')
         WITH CHECK (auth.role() = ''authenticated'');',
        r.table_name
      );

      -- Add blocking DELETE policy (overrides FOR ALL for DELETE - actually FOR ALL
      -- covers DELETE. We need to NOT allow DELETE. So we need separate policies.
      -- Drop the one we just created and use separate policies.
      EXECUTE format(
        'DROP POLICY IF EXISTS "Authenticated users can access data" ON public.%I;',
        r.table_name
      );

      -- Create SELECT, INSERT, UPDATE only (FOR ALL minus DELETE = use 3 separate)
      EXECUTE format(
        'CREATE POLICY "Authenticated users can select" ON public.%I
         FOR SELECT TO authenticated USING (auth.role() = ''authenticated'');',
        r.table_name
      );
      EXECUTE format(
        'CREATE POLICY "Authenticated users can insert" ON public.%I
         FOR INSERT TO authenticated WITH CHECK (auth.role() = ''authenticated'');',
        r.table_name
      );
      EXECUTE format(
        'CREATE POLICY "Authenticated users can update" ON public.%I
         FOR UPDATE TO authenticated USING (auth.role() = ''authenticated'')
         WITH CHECK (auth.role() = ''authenticated'');',
        r.table_name
      );

      -- Block DELETE
      EXECUTE format(
        'DROP POLICY IF EXISTS "block_hard_delete_dynamic" ON public.%I;',
        r.table_name
      );
      EXECUTE format(
        'CREATE POLICY "block_hard_delete_dynamic" ON public.%I
         FOR DELETE TO authenticated USING (false);',
        r.table_name
      );
    END IF;
  END LOOP;
END $$;
