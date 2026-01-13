-- Check default page configuration and activation
-- This script helps diagnose why the default page isn't being activated correctly

-- 1. Check workspace_settings for default_interface_id
SELECT 
  'Workspace Settings' as check_type,
  id,
  default_interface_id,
  created_at,
  updated_at
FROM workspace_settings
LIMIT 1;

-- 2. Check if the default_interface_id exists in interface_pages
SELECT 
  'Default Page Check' as check_type,
  ws.default_interface_id,
  ip.id as page_exists,
  ip.name as page_name,
  ip.is_admin_only,
  CASE 
    WHEN ip.id IS NULL THEN 'Page not found in interface_pages'
    WHEN ip.is_admin_only = true THEN 'Page is admin-only'
    ELSE 'Page exists and is accessible'
  END as status
FROM workspace_settings ws
LEFT JOIN interface_pages ip ON ip.id = ws.default_interface_id
LIMIT 1;

-- 3. List all interface_pages with their IDs
SELECT 
  'All Interface Pages' as check_type,
  id,
  name,
  is_admin_only,
  order_index,
  created_at
FROM interface_pages
ORDER BY order_index, created_at;

-- 4. Check if default_interface_id exists in views table (old system)
SELECT 
  'Default Page in Views (old system)' as check_type,
  ws.default_interface_id,
  v.id as view_exists,
  v.name as view_name,
  v.type as view_type,
  v.is_admin_only
FROM workspace_settings ws
LEFT JOIN views v ON v.id = ws.default_interface_id AND v.type = 'interface'
LIMIT 1;

-- 5. Check foreign key constraint
SELECT 
  'Foreign Key Constraint' as check_type,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'workspace_settings'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'default_interface_id';
