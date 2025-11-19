-- ============================================
-- SUPABASE STORAGE RLS POLICIES FOR ATTACHMENTS
-- Run this in Supabase SQL Editor
-- ============================================
-- This script sets up RLS policies for the "attachments" bucket
-- to allow the app to upload, update, and delete files
-- ============================================

-- Note: Make sure the "attachments" bucket exists first
-- Go to Supabase Dashboard → Storage → New bucket
-- Name: attachments
-- Public: false (we'll use RLS policies)

-- ============================================
-- ALLOW UPLOADS (INSERT)
-- ============================================
CREATE POLICY IF NOT EXISTS "Allow uploads" ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'attachments');

-- ============================================
-- ALLOW UPDATES
-- ============================================
CREATE POLICY IF NOT EXISTS "Allow updates" ON storage.objects
FOR UPDATE
USING (bucket_id = 'attachments');

-- ============================================
-- ALLOW DELETES
-- ============================================
CREATE POLICY IF NOT EXISTS "Allow deletes" ON storage.objects
FOR DELETE
USING (bucket_id = 'attachments');

-- ============================================
-- ALLOW READS (SELECT) - Public access for viewing
-- ============================================
CREATE POLICY IF NOT EXISTS "Allow public reads" ON storage.objects
FOR SELECT
USING (bucket_id = 'attachments');

-- ============================================
-- VERIFY SETUP
-- ============================================
-- After running, check:
-- 1. Storage → attachments bucket exists
-- 2. Storage → attachments → Policies → Should see 4 policies
-- 3. Test upload in the app
-- ============================================

-- ============================================
-- ALTERNATIVE: Make bucket public (simpler)
-- ============================================
-- If you prefer, you can make the bucket public instead:
-- 1. Go to Storage → attachments → Settings
-- 2. Enable "Public bucket"
-- 3. This allows all operations without RLS policies
-- ============================================

