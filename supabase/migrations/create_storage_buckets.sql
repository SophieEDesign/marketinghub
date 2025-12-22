-- Migration: Create storage buckets for branding and attachments
-- Run this in Supabase SQL Editor or via migration

-- Note: Storage buckets must be created via Supabase Dashboard or Storage API
-- This SQL file provides instructions and bucket policies

-- To create buckets manually:
-- 1. Go to Supabase Dashboard → Storage
-- 2. Create bucket named "attachments" (public)
-- 3. Create bucket named "public" (public) - optional, for general public files
-- 4. Create bucket named "branding" (public) - optional, specifically for branding

-- Storage bucket policies are managed via Supabase Dashboard or Storage API
-- The following policies can be set via Dashboard:

-- For "attachments" bucket:
-- Policy: "Allow authenticated users to upload"
--   - Operation: INSERT
--   - Target roles: authenticated
--   - Policy definition: true

-- Policy: "Allow public read access"
--   - Operation: SELECT
--   - Target roles: anon, authenticated
--   - Policy definition: true

-- Policy: "Allow authenticated users to update"
--   - Operation: UPDATE
--   - Target roles: authenticated
--   - Policy definition: true

-- Policy: "Allow authenticated users to delete"
--   - Operation: DELETE
--   - Target roles: authenticated
--   - Policy definition: true

-- Note: Bucket creation via SQL is not directly supported
-- Use Supabase Dashboard → Storage → New Bucket
-- Or use the Storage API:
-- POST /storage/v1/bucket
-- {
--   "name": "attachments",
--   "public": true,
--   "file_size_limit": 52428800,
--   "allowed_mime_types": ["image/*", "application/pdf"]
-- }
