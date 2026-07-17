-- Quick check: What is the actual CORS value?
-- Run this to see the exact value that's currently set

SELECT 
  current_setting('pgrst.server_cors_allowed_origins', true) AS current_cors_value,
  LENGTH(current_setting('pgrst.server_cors_allowed_origins', true)) AS value_length,
  CASE 
    WHEN current_setting('pgrst.server_cors_allowed_origins', true) IS NULL 
    THEN 'NULL'
    WHEN current_setting('pgrst.server_cors_allowed_origins', true) = ''
    THEN 'EMPTY STRING'
    WHEN current_setting('pgrst.server_cors_allowed_origins', true) LIKE '%marketing.petersandmay.com%' 
    THEN '✓ Contains production domain'
    WHEN current_setting('pgrst.server_cors_allowed_origins', true) LIKE '%localhost%' 
    THEN 'Contains localhost but NOT production domain'
    ELSE 'Unknown value - check above'
  END AS status;
