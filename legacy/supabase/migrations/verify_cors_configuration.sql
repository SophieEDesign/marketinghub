-- Verify CORS Configuration
-- Run this in Supabase SQL Editor to check if CORS is properly configured
-- 
-- This will help diagnose why CORS errors might still be occurring

-- Check PostgREST (Data API) CORS configuration
SELECT 
  'PostgREST CORS Configuration' AS check_type,
  current_setting('pgrst.server_cors_allowed_origins', true) AS current_value,
  CASE 
    WHEN current_setting('pgrst.server_cors_allowed_origins', true) IS NULL 
    THEN '✗ NOT SET - Using default (wildcard *)'
    WHEN current_setting('pgrst.server_cors_allowed_origins', true) = '*'
    THEN '✗ WILDCARD - This will fail with credentials: include'
    WHEN current_setting('pgrst.server_cors_allowed_origins', true) LIKE '%marketing.petersandmay.com%'
    THEN '✓ Production domain configured'
    ELSE '⚠ Partially configured - check value'
  END AS status;

-- Detailed breakdown
DO $$
DECLARE
  cors_setting text;
  has_production boolean;
  has_localhost boolean;
BEGIN
  cors_setting := current_setting('pgrst.server_cors_allowed_origins', true);
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CORS Configuration Diagnostic';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Current setting: %', COALESCE(cors_setting, 'NULL (using default wildcard)');
  RAISE NOTICE '';
  
  IF cors_setting IS NULL OR cors_setting = '*' THEN
    RAISE WARNING '✗ CORS is using wildcard (*) - This will cause errors with credentials: include';
    RAISE NOTICE '  Fix: Run fix_cors_for_production_domain.sql migration';
  ELSE
    RAISE NOTICE '✓ CORS is configured (not using wildcard)';
    
    has_production := cors_setting LIKE '%marketing.petersandmay.com%';
    has_localhost := cors_setting LIKE '%localhost%';
    
    IF has_production THEN
      RAISE NOTICE '✓ Production domain (marketing.petersandmay.com) is configured';
    ELSE
      RAISE WARNING '✗ Production domain (marketing.petersandmay.com) NOT found!';
    END IF;
    
    IF has_localhost THEN
      RAISE NOTICE '✓ Localhost (development) is configured';
    ELSE
      RAISE NOTICE 'ℹ Localhost not configured (OK for production-only)';
    END IF;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '========================================';
  RAISE NOTICE '1. If CORS shows wildcard or NULL, run fix_cors_for_production_domain.sql';
  RAISE NOTICE '2. Verify Auth API CORS in Dashboard: Authentication → URL Configuration';
  RAISE NOTICE '3. Wait 2-3 minutes after changes for propagation';
  RAISE NOTICE '4. Clear browser cache or use incognito mode';
  RAISE NOTICE '5. Check browser DevTools Network tab for actual CORS headers';
END $$;
