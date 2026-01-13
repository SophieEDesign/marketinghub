-- Comprehensive diagnostic for default page issue
-- Run this to see exactly what's happening with the default page configuration

-- 1. Check if workspace_settings exists and has a default_interface_id
SELECT 
  'Step 1: Workspace Settings' as step,
  CASE 
    WHEN COUNT(*) = 0 THEN 'No workspace_settings row found'
    WHEN COUNT(*) > 0 AND COUNT(*) FILTER (WHERE default_interface_id IS NOT NULL) = 0 THEN 'Workspace settings exists but default_interface_id is NULL'
    ELSE 'Workspace settings exists with default_interface_id set'
  END as status,
  MAX(default_interface_id) as default_interface_id,
  COUNT(*) as row_count
FROM workspace_settings;

-- 2. Get the actual default_interface_id value
SELECT 
  'Step 2: Default Page ID' as step,
  id as settings_id,
  default_interface_id,
  created_at,
  updated_at
FROM workspace_settings
LIMIT 1;

-- 3. Check if the default page exists in interface_pages
SELECT 
  'Step 3: Page Existence Check' as step,
  ws.default_interface_id as configured_page_id,
  ip.id as page_found,
  ip.name as page_name,
  ip.is_admin_only,
  ip.order_index,
  CASE 
    WHEN ip.id IS NULL THEN '❌ Page NOT FOUND in interface_pages'
    WHEN ip.is_admin_only = true THEN '⚠️ Page exists but is ADMIN-ONLY'
    ELSE '✅ Page exists and is accessible'
  END as status
FROM workspace_settings ws
LEFT JOIN interface_pages ip ON ip.id = ws.default_interface_id;

-- 4. List ALL interface pages in order (this is what getAccessibleInterfacePages returns)
SELECT 
  'Step 4: All Accessible Pages (in order)' as step,
  id,
  name,
  is_admin_only,
  order_index,
  created_at,
  CASE 
    WHEN id = (SELECT default_interface_id FROM workspace_settings LIMIT 1) THEN '⭐ DEFAULT PAGE'
    WHEN ROW_NUMBER() OVER (ORDER BY order_index, created_at) = 1 THEN '→ First accessible (fallback)'
    ELSE ''
  END as note
FROM interface_pages
WHERE is_admin_only IS NULL OR is_admin_only = false
ORDER BY order_index, created_at;

-- 5. Check if there are any RLS policies that might block access
SELECT 
  'Step 5: RLS Policies Check' as step,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('workspace_settings', 'interface_pages')
ORDER BY tablename, policyname;

-- 6. Test query: Try to read workspace_settings (simulating what the code does)
SELECT 
  'Step 6: Test Query (simulating code)' as step,
  default_interface_id,
  CASE 
    WHEN default_interface_id IS NOT NULL THEN '✅ Query successful, default_interface_id found'
    ELSE '⚠️ Query successful but default_interface_id is NULL'
  END as query_result
FROM workspace_settings
LIMIT 1;

-- 7. Check if default page exists in views table (old system fallback)
SELECT 
  'Step 7: Old System Check' as step,
  ws.default_interface_id as configured_page_id,
  v.id as view_found,
  v.name as view_name,
  v.type as view_type,
  v.is_admin_only,
  CASE 
    WHEN v.id IS NULL THEN 'Not found in views table (expected if using new system)'
    WHEN v.type != 'interface' THEN 'Found but wrong type: ' || v.type
    ELSE 'Found in views table (old system)'
  END as status
FROM workspace_settings ws
LEFT JOIN views v ON v.id = ws.default_interface_id;
