-- Migration: Fix RLS policies for interface_pages table
-- The existing policy is missing WITH CHECK clause which is required for INSERT operations
-- Also, we should allow all authenticated users to create pages (like other tables)
-- Fixed: Changed profiles.id to profiles.user_id to correctly match authenticated users

-- Drop the existing policies (idempotent)
DROP POLICY IF EXISTS "Allow authenticated users to read interface pages" ON interface_pages;
DROP POLICY IF EXISTS "Allow authenticated users to create interface pages" ON interface_pages;
DROP POLICY IF EXISTS "Allow admins to manage interface pages" ON interface_pages;
DROP POLICY IF EXISTS "Allow admins to update interface pages" ON interface_pages;
DROP POLICY IF EXISTS "Allow admins to delete interface pages" ON interface_pages;

-- Allow authenticated users to read interface pages (respecting is_admin_only flag)
CREATE POLICY "Allow authenticated users to read interface pages"
  ON interface_pages
  FOR SELECT
  TO authenticated
  USING (
    NOT is_admin_only OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Allow all authenticated users to insert interface pages
CREATE POLICY "Allow authenticated users to create interface pages"
  ON interface_pages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow admins to update interface pages
CREATE POLICY "Allow admins to update interface pages"
  ON interface_pages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Allow admins to delete interface pages
CREATE POLICY "Allow admins to delete interface pages"
  ON interface_pages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

