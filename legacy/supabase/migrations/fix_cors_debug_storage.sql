-- DEBUG: Check how the CORS setting is actually stored
-- This will help us understand why it's showing as empty string

-- Check the role's actual configuration
SELECT 
  rolname,
  rolconfig
FROM pg_roles 
WHERE rolname = 'authenticator';

-- Check if the setting exists in pg_settings
SELECT 
  name,
  setting,
  source,
  context,
  vartype
FROM pg_settings 
WHERE name = 'pgrst.server_cors_allowed_origins'
   OR name LIKE '%cors%'
ORDER BY name;

-- Try reading the setting with different methods
SELECT 
  'Method 1: current_setting with true' AS method,
  current_setting('pgrst.server_cors_allowed_origins', true) AS value;

SELECT 
  'Method 2: current_setting without true' AS method,
  current_setting('pgrst.server_cors_allowed_origins', false) AS value;

-- Check if it's stored as a role variable
SELECT 
  'Role config' AS source,
  unnest(rolconfig) AS config_line
FROM pg_roles 
WHERE rolname = 'authenticator';
