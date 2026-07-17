-- Set CORS configuration on anon role
-- PostgREST in managed Supabase may connect as 'anon' instead of 'authenticator'
-- This is a test to see if setting it on anon resolves the issue

-- Set CORS on anon role
ALTER ROLE anon
SET pgrst.server_cors_allowed_origins='http://localhost:3000,https://marketing.petersandmay.com,https://marketinghub-jet.vercel.app';

-- Reload PostgREST configuration
NOTIFY pgrst,'reload config';

-- Verify it was set (using CROSS JOIN LATERAL to properly unnest)
SELECT
  'anon role config' AS check_type,
  cfg.config_line
FROM pg_roles
CROSS JOIN LATERAL unnest(rolconfig) AS cfg(config_line)
WHERE rolname = 'anon'
  AND cfg.config_line LIKE 'pgrst.%';

-- Also verify authenticator still has it
SELECT
  'authenticator role config' AS check_type,
  cfg.config_line
FROM pg_roles
CROSS JOIN LATERAL unnest(rolconfig) AS cfg(config_line)
WHERE rolname = 'authenticator'
  AND cfg.config_line LIKE 'pgrst.%';

-- Check full rolconfig arrays to see everything
SELECT 
  rolname,
  rolconfig
FROM pg_roles 
WHERE rolname IN ('anon', 'authenticator')
ORDER BY rolname;
