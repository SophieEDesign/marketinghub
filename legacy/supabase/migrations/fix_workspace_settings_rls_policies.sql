-- Migration: Restore workspace_settings RLS policies (admin update/insert)
-- Problem: fix_profiles_rls_policies.sql can drop workspace_settings UPDATE/INSERT policies
-- without recreating them, which makes updates silently affect 0 rows under RLS.
--
-- This migration is idempotent and only runs if workspace_settings exists.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'workspace_settings'
  ) THEN
    -- Ensure RLS is enabled
    EXECUTE 'ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY';

    -- Recreate canonical policies used by the app
    EXECUTE 'DROP POLICY IF EXISTS "Users can read workspace settings" ON public.workspace_settings';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can update workspace settings" ON public.workspace_settings';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can insert workspace settings" ON public.workspace_settings';

    -- Authenticated users can read workspace settings (branding + defaults)
    EXECUTE $policy$
      CREATE POLICY "Users can read workspace settings"
        ON public.workspace_settings
        FOR SELECT
        TO authenticated
        USING (true)
    $policy$;

    -- Admins can update workspace settings
    EXECUTE $policy$
      CREATE POLICY "Admins can update workspace settings"
        ON public.workspace_settings
        FOR UPDATE
        TO authenticated
        USING (public.is_admin())
        WITH CHECK (public.is_admin())
    $policy$;

    -- Admins can insert workspace settings
    EXECUTE $policy$
      CREATE POLICY "Admins can insert workspace settings"
        ON public.workspace_settings
        FOR INSERT
        TO authenticated
        WITH CHECK (public.is_admin())
    $policy$;
  END IF;
END $$;

