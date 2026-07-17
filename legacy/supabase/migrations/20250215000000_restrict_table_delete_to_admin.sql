-- Restrict table deletion to admins only (RLS hardening)
-- Previously: any authenticated user could delete tables (admin enforced in app only)
-- Now: only users with admin role can delete tables at database level

-- Drop the permissive policy
DROP POLICY IF EXISTS "Authenticated users can delete tables" ON public.tables;

-- Create admin-only delete policy
CREATE POLICY "Only admins can delete tables"
  ON public.tables
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

COMMENT ON POLICY "Only admins can delete tables" ON public.tables IS
  'Table deletion restricted to admin role. Enforced at database level for defense in depth.';
