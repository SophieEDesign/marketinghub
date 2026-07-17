-- EXECUTE THIS SCRIPT TO FIX CORS CONFIGURATION
-- Run this ENTIRE script in Supabase SQL Editor
-- This will attempt to set CORS and report any errors

-- ============================================
-- ATTEMPT TO SET CORS CONFIGURATION
-- ============================================
DO $$
BEGIN
  BEGIN
    -- Set CORS allowed origins for all environments
    ALTER ROLE authenticator
    SET pgrst.server_cors_allowed_origins='http://localhost:3000,https://marketing.petersandmay.com,https://marketinghub-jet.vercel.app';
    
    RAISE NOTICE '✓ ALTER ROLE command executed successfully';
  EXCEPTION 
    WHEN insufficient_privilege THEN
      RAISE WARNING '✗ ERROR: Insufficient privileges to ALTER ROLE authenticator';
      RAISE NOTICE '  This requires owner/service_role privileges.';
      RAISE NOTICE '  Contact Supabase Support or use service_role key.';
    WHEN OTHERS THEN
      RAISE WARNING '✗ ERROR setting CORS: %', SQLERRM;
      RAISE NOTICE '  Error code: %', SQLSTATE;
  END;
END $$;

-- ============================================
-- RELOAD POSTGREST CONFIGURATION
-- ============================================
DO $$
BEGIN
  BEGIN
    NOTIFY pgrst,'reload config';
    RAISE NOTICE '✓ NOTIFY pgrst command executed';
  EXCEPTION 
    WHEN OTHERS THEN
      RAISE WARNING '✗ ERROR with NOTIFY: %', SQLERRM;
  END;
END $$;

-- ============================================
-- VERIFY CONFIGURATION
-- ============================================
SELECT 
  'Verification' AS step,
  current_setting('pgrst.server_cors_allowed_origins', true) AS cors_allowed_origins,
  CASE 
    WHEN current_setting('pgrst.server_cors_allowed_origins', true) IS NULL 
    THEN '✗ NULL - Configuration did not apply. Check error messages above.'
    WHEN current_setting('pgrst.server_cors_allowed_origins', true) LIKE '%marketing.petersandmay.com%' 
    THEN '✓ SUCCESS - Production domain is configured!'
    WHEN current_setting('pgrst.server_cors_allowed_origins', true) = ''
    THEN '⚠ EMPTY STRING - Configuration may need to be set again'
    ELSE '⚠ Partially configured - Value: ' || COALESCE(current_setting('pgrst.server_cors_allowed_origins', true), 'NULL')
  END AS status;
