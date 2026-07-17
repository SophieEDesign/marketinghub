-- COMPREHENSIVE CORS FIX with Diagnostics
-- This script will diagnose and fix CORS configuration issues
-- Run this ENTIRE script in Supabase SQL Editor

-- ============================================
-- STEP 1: DIAGNOSTICS
-- ============================================
DO $$
DECLARE
  current_user_name text;
  is_superuser boolean;
  role_exists boolean;
  current_cors text;
BEGIN
  -- Check current user and permissions
  SELECT current_user INTO current_user_name;
  SELECT usesuper INTO is_superuser FROM pg_user WHERE usename = current_user_name;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CORS Configuration Diagnostics';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Current user: %', current_user_name;
  RAISE NOTICE 'Is superuser: %', COALESCE(is_superuser::text, 'unknown');
  
  -- Check if authenticator role exists
  SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') INTO role_exists;
  RAISE NOTICE 'Authenticator role exists: %', role_exists;
  
  -- Check current CORS setting
  BEGIN
    current_cors := current_setting('pgrst.server_cors_allowed_origins', true);
    RAISE NOTICE 'Current CORS setting: %', COALESCE(current_cors, 'NULL');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not read CORS setting: %', SQLERRM;
  END;
  
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- STEP 2: CHECK ROLE PERMISSIONS
-- ============================================
SELECT 
  rolname,
  rolsuper,
  rolcreaterole,
  rolcanlogin
FROM pg_roles 
WHERE rolname IN ('authenticator', 'postgres', 'supabase_admin', current_user)
ORDER BY rolname;

-- ============================================
-- STEP 3: ATTEMPT TO SET CORS CONFIGURATION
-- ============================================
-- Try method 1: Direct ALTER ROLE (standard approach)
DO $$
BEGIN
  BEGIN
    ALTER ROLE authenticator SET pgrst.server_cors_allowed_origins='http://localhost:3000,https://marketing.petersandmay.com,https://marketinghub-jet.vercel.app';
    RAISE NOTICE '✓ ALTER ROLE command executed successfully';
  EXCEPTION 
    WHEN insufficient_privilege THEN
      RAISE WARNING '✗ Insufficient privileges to ALTER ROLE authenticator';
      RAISE NOTICE '  You may need to run this as a superuser or contact Supabase support';
    WHEN OTHERS THEN
      RAISE WARNING '✗ Error setting CORS: %', SQLERRM;
  END;
END $$;

-- ============================================
-- STEP 4: RELOAD CONFIGURATION
-- ============================================
DO $$
BEGIN
  BEGIN
    NOTIFY pgrst,'reload config';
    RAISE NOTICE '✓ NOTIFY pgrst command executed';
  EXCEPTION 
    WHEN OTHERS THEN
      RAISE WARNING '✗ Error with NOTIFY: %', SQLERRM;
  END;
END $$;

-- ============================================
-- STEP 5: VERIFY CONFIGURATION
-- ============================================
SELECT 
  'Verification' AS step,
  current_setting('pgrst.server_cors_allowed_origins', true) AS cors_allowed_origins,
  CASE 
    WHEN current_setting('pgrst.server_cors_allowed_origins', true) IS NULL 
    THEN '✗ NULL - Configuration did not apply. Check permissions or contact Supabase support.'
    WHEN current_setting('pgrst.server_cors_allowed_origins', true) LIKE '%marketing.petersandmay.com%' 
    THEN '✓ SUCCESS - Production domain is configured!'
    WHEN current_setting('pgrst.server_cors_allowed_origins', true) = ''
    THEN '⚠ EMPTY STRING - Configuration may need to be set again'
    ELSE '⚠ Partially configured - Value: ' || COALESCE(current_setting('pgrst.server_cors_allowed_origins', true), 'NULL')
  END AS cors_allowed_status;

-- ============================================
-- STEP 6: ALTERNATIVE - Check if setting exists in pg_settings
-- ============================================
SELECT 
  name,
  setting,
  source,
  context
FROM pg_settings 
WHERE name LIKE '%cors%' OR name LIKE '%pgrst%'
ORDER BY name;

-- ============================================
-- NEXT STEPS IF STILL NULL
-- ============================================
DO $$
BEGIN
  IF current_setting('pgrst.server_cors_allowed_origins', true) IS NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '⚠ CORS configuration is still NULL';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Possible solutions:';
    RAISE NOTICE '1. Contact Supabase Support - This may require project-level configuration';
    RAISE NOTICE '2. Check if you have the correct permissions (superuser or project owner)';
    RAISE NOTICE '3. Try using Supabase CLI: supabase db reset (if using local development)';
    RAISE NOTICE '4. Check Supabase Dashboard → Settings → API for CORS configuration';
    RAISE NOTICE '';
    RAISE NOTICE 'For Auth API CORS, you MUST configure in Dashboard:';
    RAISE NOTICE '  Authentication → URL Configuration → Site URL';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ CORS configuration appears to be set!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Wait 1-2 minutes for changes to propagate, then test.';
  END IF;
END $$;
