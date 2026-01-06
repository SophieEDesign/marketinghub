-- Migration: Fix DELETE and UPDATE permissions for interface_pages table
-- Currently only admins can delete/update interface pages, but users should be able to manage pages they created
-- This aligns with the views table policy that allows authenticated users to delete interface pages

-- Drop the existing admin-only policies
DROP POLICY IF EXISTS "Allow admins to delete interface pages" ON interface_pages;
DROP POLICY IF EXISTS "Allow admins to update interface pages" ON interface_pages;

-- Allow authenticated users to delete interface pages they created
CREATE POLICY "Allow users to delete their own interface pages"
  ON interface_pages
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
  );

-- Allow admins to delete any interface page
CREATE POLICY "Allow admins to delete any interface page"
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

-- Also allow all authenticated users to delete interface pages (most permissive)
-- This matches the policy for views table where interface pages can be deleted by any authenticated user
CREATE POLICY "Allow authenticated users to delete interface pages"
  ON interface_pages
  FOR DELETE
  TO authenticated
  USING (true);

COMMENT ON POLICY "Allow users to delete their own interface pages" ON interface_pages IS 
  'Users can delete interface pages they created';

COMMENT ON POLICY "Allow admins to delete any interface page" ON interface_pages IS 
  'Admins can delete any interface page regardless of ownership';

COMMENT ON POLICY "Allow authenticated users to delete interface pages" ON interface_pages IS 
  'All authenticated users can delete interface pages (most permissive policy)';

-- Also fix UPDATE permissions to allow users to update their own pages
-- Allow users to update interface pages they created
CREATE POLICY "Allow users to update their own interface pages"
  ON interface_pages
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
  )
  WITH CHECK (
    created_by = auth.uid()
  );

-- Allow admins to update any interface page
CREATE POLICY "Allow admins to update any interface page"
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

COMMENT ON POLICY "Allow users to update their own interface pages" ON interface_pages IS 
  'Users can update interface pages they created';

COMMENT ON POLICY "Allow admins to update any interface page" ON interface_pages IS 
  'Admins can update any interface page regardless of ownership';

