-- RLS hardening sweep (phase 1)
-- Scope: replace broad permissive policies with explicit least-privilege rules
-- for high-sensitivity configuration/authorization tables only.

BEGIN;

-- Ensure helper exists (canonical signature in this repo)
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE user_id = uid;
  RETURN COALESCE(user_role = 'admin', false);
END;
$$;

-- Drop broad permissive policies (`USING (true)` / `WITH CHECK (true)`) for target tables.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('interface_pages', 'interface_groups', 'workspaces', 'workspace_settings', 'user_roles')
      AND (
        COALESCE(TRIM(qual), '') IN ('true', '(true)')
        OR COALESCE(TRIM(with_check), '') IN ('true', '(true)')
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', p.policyname, p.tablename);
  END LOOP;
END $$;

-- Also drop known legacy names to avoid duplicates/conflicts.
DROP POLICY IF EXISTS "Allow authenticated users to read interface pages" ON public.interface_pages;
DROP POLICY IF EXISTS "Allow authenticated users to create interface pages" ON public.interface_pages;
DROP POLICY IF EXISTS "Users can update their interface pages" ON public.interface_pages;
DROP POLICY IF EXISTS "Users can delete their interface pages" ON public.interface_pages;
DROP POLICY IF EXISTS "Allow users to update their own interface pages" ON public.interface_pages;
DROP POLICY IF EXISTS "Allow authenticated users to delete interface pages" ON public.interface_pages;

DROP POLICY IF EXISTS "Allow authenticated users to read interface groups" ON public.interface_groups;
DROP POLICY IF EXISTS "Allow authenticated users to insert interface groups" ON public.interface_groups;
DROP POLICY IF EXISTS "Allow authenticated users to update interface groups" ON public.interface_groups;
DROP POLICY IF EXISTS "Allow authenticated users to delete interface groups" ON public.interface_groups;
DROP POLICY IF EXISTS "Users can update interface groups" ON public.interface_groups;
DROP POLICY IF EXISTS "Users can delete interface groups" ON public.interface_groups;

DROP POLICY IF EXISTS "Allow authenticated users to read workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Allow authenticated users to update workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Allow authenticated users to insert workspace" ON public.workspaces;

DROP POLICY IF EXISTS "Users can read workspace settings" ON public.workspace_settings;
DROP POLICY IF EXISTS "Admins can update workspace settings" ON public.workspace_settings;
DROP POLICY IF EXISTS "Admins can insert workspace settings" ON public.workspace_settings;

DROP POLICY IF EXISTS "Users can read user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read all user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user_roles" ON public.user_roles;

-- -------------------------
-- interface_pages
-- -------------------------
-- Read: all authenticated users can read non-archived pages; admin-only pages require admin.
CREATE POLICY "rls_interface_pages_select_scoped"
  ON public.interface_pages
  FOR SELECT
  TO authenticated
  USING (
    COALESCE(is_archived, false) = false
    AND (COALESCE(is_admin_only, false) = false OR public.is_admin(auth.uid()))
  );

-- Write: admin only.
CREATE POLICY "rls_interface_pages_insert_admin"
  ON public.interface_pages
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "rls_interface_pages_update_admin"
  ON public.interface_pages
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "rls_interface_pages_delete_admin"
  ON public.interface_pages
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- -------------------------
-- interface_groups
-- -------------------------
-- Read: authenticated users can read groups; writes are admin-only.
CREATE POLICY "rls_interface_groups_select_authenticated"
  ON public.interface_groups
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "rls_interface_groups_insert_admin"
  ON public.interface_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "rls_interface_groups_update_admin"
  ON public.interface_groups
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "rls_interface_groups_delete_admin"
  ON public.interface_groups
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- -------------------------
-- workspaces
-- -------------------------
-- Read: authenticated users can read workspace identity.
-- Write: admin only.
CREATE POLICY "rls_workspaces_select_authenticated"
  ON public.workspaces
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "rls_workspaces_insert_admin"
  ON public.workspaces
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "rls_workspaces_update_admin"
  ON public.workspaces
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "rls_workspaces_delete_admin"
  ON public.workspaces
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- -------------------------
-- workspace_settings
-- -------------------------
-- Read: authenticated users can read branding/default settings.
-- Write: admin only.
CREATE POLICY "rls_workspace_settings_select_authenticated"
  ON public.workspace_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "rls_workspace_settings_insert_admin"
  ON public.workspace_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "rls_workspace_settings_update_admin"
  ON public.workspace_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "rls_workspace_settings_delete_admin"
  ON public.workspace_settings
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- -------------------------
-- user_roles (legacy table)
-- -------------------------
-- Read: user can read own rows; admin can read all.
-- Write: admin only.
CREATE POLICY "rls_user_roles_select_own"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "rls_user_roles_select_admin_all"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "rls_user_roles_insert_admin"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "rls_user_roles_update_admin"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "rls_user_roles_delete_admin"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

COMMIT;
