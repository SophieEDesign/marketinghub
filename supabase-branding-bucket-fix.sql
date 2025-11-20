-- ============================================
-- FIX BRANDING BUCKET FOR LOGO UPLOAD
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Create branding bucket if it doesn't exist
-- Note: This must be done via Dashboard UI, but we'll verify it exists
-- Go to: Storage → New bucket → Name: "branding" → Public: ✅

-- Step 2: Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies for branding bucket (if any)
DROP POLICY IF EXISTS "Allow public SELECT on branding bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public INSERT on branding bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public UPDATE on branding bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public DELETE on branding bucket" ON storage.objects;

-- Step 4: Create policies for branding bucket

-- Allow public SELECT (view/download) on branding bucket
CREATE POLICY "Allow public SELECT on branding bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding');

-- Allow public INSERT (upload) on branding bucket
CREATE POLICY "Allow public INSERT on branding bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'branding');

-- Allow public UPDATE (overwrite/upsert) on branding bucket
CREATE POLICY "Allow public UPDATE on branding bucket"
ON storage.objects FOR UPDATE
USING (bucket_id = 'branding')
WITH CHECK (bucket_id = 'branding');

-- Allow public DELETE on branding bucket
CREATE POLICY "Allow public DELETE on branding bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'branding');

-- ============================================
-- VERIFY
-- ============================================
-- After running, test by:
-- 1. Going to Supabase Dashboard → Storage → branding
-- 2. Try uploading a file manually
-- 3. If manual upload works, the app upload should work too

-- Check policies exist:
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%branding%';

