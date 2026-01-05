-- Migration: Fix RLS policies for interface_pages table
-- The existing policy is missing WITH CHECK clause which is required for INSERT operations
-- Also, we should allow all authenticated users to create pages (like other tables)

-- Drop the existing policy
DROP POLICY IF EXISTS "Allow admins to manage interface pages" ON interface_pages;

-- Allow all authenticated users to insert interface pages
CREATE POLICY "Allow authenticated users to create interface pages"
  ON interface_pages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow admins to update and delete interface pages
CREATE POLICY "Allow admins to update interface pages"
  ON interface_pages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Allow admins to delete interface pages"
  ON interface_pages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

