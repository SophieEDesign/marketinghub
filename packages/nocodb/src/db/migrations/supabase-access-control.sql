-- Migration: Add access control columns to nc_views table
-- This enables page-level access control for views

-- Add access control columns
ALTER TABLE nc_views
  ADD COLUMN IF NOT EXISTS access_level TEXT DEFAULT 'authenticated',
  ADD COLUMN IF NOT EXISTS allowed_roles TEXT[] DEFAULT ARRAY['admin'],
  ADD COLUMN IF NOT EXISTS owner_id UUID,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_share_id UUID DEFAULT gen_random_uuid();

-- Create index on public_share_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_nc_views_public_share_id ON nc_views(public_share_id) WHERE public_share_id IS NOT NULL;

-- Create index on owner_id
CREATE INDEX IF NOT EXISTS idx_nc_views_owner_id ON nc_views(owner_id) WHERE owner_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN nc_views.access_level IS 'Access level: public, authenticated, role, or owner';
COMMENT ON COLUMN nc_views.allowed_roles IS 'Array of allowed roles when access_level is "role"';
COMMENT ON COLUMN nc_views.owner_id IS 'User ID of the owner when access_level is "owner"';
COMMENT ON COLUMN nc_views.is_public IS 'Whether the view is publicly accessible';
COMMENT ON COLUMN nc_views.public_share_id IS 'Unique ID for public sharing';
