-- DIRECT FIX for CORS Configuration
-- Run this ENTIRE script in Supabase SQL Editor
-- Make sure you run ALL lines together, not separately

-- Step 1: Set the CORS configuration
-- Includes: localhost (dev), production domain, and Vercel preview domain
ALTER ROLE authenticator
SET pgrst.server_cors_allowed_origins='http://localhost:3000,https://marketing.petersandmay.com,https://marketinghub-jet.vercel.app';

-- Step 2: Reload PostgREST to apply the changes
NOTIFY pgrst,'reload config';

-- Step 3: Verify it worked (run this immediately after)
SELECT 
  current_setting('pgrst.server_cors_allowed_origins', true) AS cors_allowed_origins,
  CASE 
    WHEN current_setting('pgrst.server_cors_allowed_origins', true) LIKE '%marketing.petersandmay.com%' 
    THEN '✓ Production domain configured'
    ELSE '✗ Production domain NOT configured - Try running again'
  END AS status;
