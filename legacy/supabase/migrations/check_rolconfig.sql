-- CHECK: What's actually stored in authenticator role's rolconfig
-- This will show us if the CORS setting is stored in role-local config

-- Method 1: Show raw rolconfig array
SELECT 
  'Raw rolconfig' AS check_type,
  rolname,
  rolconfig
FROM pg_roles 
WHERE rolname = 'authenticator';

-- Method 2: Unnest rolconfig to see each setting line by line
SELECT 
  'Unnested rolconfig' AS check_type,
  rolname,
  unnest(rolconfig) AS config_line
FROM pg_roles 
WHERE rolname = 'authenticator';

-- Method 3: Check if pgrst settings exist in rolconfig
SELECT 
  'pgrst settings in rolconfig' AS check_type,
  rolname,
  unnest(rolconfig) AS config_line
FROM pg_roles 
WHERE rolname = 'authenticator'
  AND unnest(rolconfig) LIKE 'pgrst.%';

-- Method 4: Try current_setting again (with error handling)
DO $$
DECLARE
  setting_value text;
BEGIN
  BEGIN
    setting_value := current_setting('pgrst.server_cors_allowed_origins', true);
    RAISE NOTICE 'current_setting returned: [%]', COALESCE(setting_value, 'NULL');
    RAISE NOTICE 'Length: %', COALESCE(LENGTH(setting_value)::text, 'NULL');
  EXCEPTION 
    WHEN undefined_object THEN
      RAISE NOTICE 'Setting does not exist as a GUC';
    WHEN OTHERS THEN
      RAISE NOTICE 'Error reading setting: %', SQLERRM;
  END;
END $$;

-- Method 5: Check other roles that might have pgrst settings
SELECT 
  'All roles with pgrst settings' AS check_type,
  rolname,
  unnest(rolconfig) AS config_line
FROM pg_roles 
WHERE rolconfig IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM unnest(rolconfig) AS config
    WHERE config LIKE 'pgrst.%'
  )
ORDER BY rolname;
