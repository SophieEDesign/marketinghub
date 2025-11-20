-- ============================================
-- FIX SUPABASE STORAGE RLS POLICIES
-- Run this in Supabase SQL Editor
-- Fixes RLS policies for branding and attachments buckets
-- ============================================

-- First, ensure the buckets exist and are public
-- If buckets don't exist, create them via Supabase Dashboard:
-- Storage → New bucket → Name: "branding" → Public: Yes
-- Storage → New bucket → Name: "attachments" → Public: Yes

-- ============================================
-- BRANDING BUCKET POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to branding" ON storage.objects;
DROP POLICY IF EXISTS "Allow public insert access to branding" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update access to branding" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete access to branding" ON storage.objects;

-- Create policies for branding bucket
-- Read: Anyone can read files from branding bucket
CREATE POLICY "Allow public read access to branding"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding');

-- Insert: Anyone can upload files to branding bucket
CREATE POLICY "Allow public insert access to branding"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'branding');

-- Update: Anyone can update files in branding bucket
CREATE POLICY "Allow public update access to branding"
ON storage.objects FOR UPDATE
USING (bucket_id = 'branding')
WITH CHECK (bucket_id = 'branding');

-- Delete: Anyone can delete files from branding bucket
CREATE POLICY "Allow public delete access to branding"
ON storage.objects FOR DELETE
USING (bucket_id = 'branding');

-- ============================================
-- ATTACHMENTS BUCKET POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow public insert access to attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update access to attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete access to attachments" ON storage.objects;

-- Create policies for attachments bucket
-- Read: Anyone can read files from attachments bucket
CREATE POLICY "Allow public read access to attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'attachments');

-- Insert: Anyone can upload files to attachments bucket
CREATE POLICY "Allow public insert access to attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'attachments');

-- Update: Anyone can update files in attachments bucket
CREATE POLICY "Allow public update access to attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'attachments')
WITH CHECK (bucket_id = 'attachments');

-- Delete: Anyone can delete files from attachments bucket
CREATE POLICY "Allow public delete access to attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'attachments');

-- ============================================
-- ASSETS BUCKET POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow public insert access to assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update access to assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete access to assets" ON storage.objects;

-- Create policies for assets bucket
CREATE POLICY "Allow public read access to assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'assets');

CREATE POLICY "Allow public insert access to assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'assets');

CREATE POLICY "Allow public update access to assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'assets')
WITH CHECK (bucket_id = 'assets');

CREATE POLICY "Allow public delete access to assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'assets');

-- ============================================
-- MEDIA BUCKET POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to media" ON storage.objects;
DROP POLICY IF EXISTS "Allow public insert access to media" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update access to media" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete access to media" ON storage.objects;

-- Create policies for media bucket
CREATE POLICY "Allow public read access to media"
ON storage.objects FOR SELECT
USING (bucket_id = 'media');

CREATE POLICY "Allow public insert access to media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'media');

CREATE POLICY "Allow public update access to media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'media')
WITH CHECK (bucket_id = 'media');

CREATE POLICY "Allow public delete access to media"
ON storage.objects FOR DELETE
USING (bucket_id = 'media');

-- ============================================
-- VERIFY BUCKETS EXIST
-- ============================================
-- Note: Buckets must be created via Supabase Dashboard:
-- 1. Go to Storage → New bucket
-- 2. Create these buckets (all should be Public: Yes):
--    - "branding" (for logo uploads)
--    - "attachments" (for file attachments)
--    - "assets" (for asset files)
--    - "media" (for media files)
-- 
-- Or run these commands if you have access:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('assets', 'assets', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true) ON CONFLICT DO NOTHING;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- After running this:
-- 1. Verify buckets exist in Storage dashboard
-- 2. Verify buckets are set to "Public"
-- 3. Test logo upload in the app
-- ============================================

