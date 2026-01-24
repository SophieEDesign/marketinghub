-- Compare CORS configuration between working and non-working projects
-- This will help identify what's different about the working project

-- Check rolconfig for all key roles in the current project
-- (This is the non-working project: hwtycgvclhckglmuwnmw)
SELECT 
  'Current Project (hwtycgvclhckglmuwnmw)' AS project,
  rolname,
  rolconfig
FROM pg_roles 
WHERE rolname IN ('anon', 'authenticator', 'postgres', 'service_role')
ORDER BY rolname;

-- Instructions for checking the working project (81k6ChVND):
-- 1. Switch to that project in Supabase Dashboard
-- 2. Run this query in that project's SQL Editor:
/*
SELECT 
  'Working Project (81k6ChVND)' AS project,
  rolname,
  rolconfig
FROM pg_roles 
WHERE rolname IN ('anon', 'authenticator', 'postgres', 'service_role')
ORDER BY rolname;
*/

-- Also check if there are any differences in pg_settings
SELECT 
  name,
  setting,
  source,
  context
FROM pg_settings 
WHERE name LIKE '%cors%' OR name LIKE '%pgrst%'
ORDER BY name;
