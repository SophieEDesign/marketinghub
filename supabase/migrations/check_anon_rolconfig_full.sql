-- Check full rolconfig arrays for anon and authenticator
-- This will show us exactly what's stored in each role's configuration

SELECT 
  rolname,
  rolconfig
FROM pg_roles 
WHERE rolname IN ('anon', 'authenticator')
ORDER BY rolname;

-- Also check if anon has any config at all
SELECT 
  rolname,
  CASE 
    WHEN rolconfig IS NULL THEN 'NULL'
    WHEN array_length(rolconfig, 1) IS NULL THEN 'EMPTY ARRAY'
    ELSE array_length(rolconfig, 1)::text || ' entries'
  END AS config_status,
  rolconfig
FROM pg_roles 
WHERE rolname = 'anon';
