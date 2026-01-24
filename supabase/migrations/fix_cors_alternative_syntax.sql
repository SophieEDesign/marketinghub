-- ALTERNATIVE: Try setting CORS with different syntax
-- Sometimes the issue is with how the value is quoted or formatted

-- Method 1: Try with explicit quotes and escaping
DO $$
BEGIN
  -- Reset first
  ALTER ROLE authenticator RESET pgrst.server_cors_allowed_origins;
  RAISE NOTICE 'Reset CORS setting';
END $$;

-- Wait a moment (not possible in SQL, but try reload)
NOTIFY pgrst,'reload config';

-- Method 2: Set with explicit value
DO $$
BEGIN
  ALTER ROLE authenticator 
  SET pgrst.server_cors_allowed_origins = 'http://localhost:3000,https://marketing.petersandmay.com,https://marketinghub-jet.vercel.app';
  RAISE NOTICE 'Set CORS with explicit = syntax';
END $$;

NOTIFY pgrst,'reload config';

-- Method 3: Verify what was actually stored
SELECT 
  'Stored value' AS check_type,
  current_setting('pgrst.server_cors_allowed_origins', true) AS value,
  LENGTH(current_setting('pgrst.server_cors_allowed_origins', true)) AS length,
  CASE 
    WHEN current_setting('pgrst.server_cors_allowed_origins', true) IS NULL THEN 'NULL'
    WHEN current_setting('pgrst.server_cors_allowed_origins', true) = '' THEN 'EMPTY STRING'
    ELSE 'HAS VALUE: ' || current_setting('pgrst.server_cors_allowed_origins', true)
  END AS status;

-- Check role config directly
SELECT 
  'Role config check' AS check_type,
  rolconfig
FROM pg_roles 
WHERE rolname = 'authenticator';
