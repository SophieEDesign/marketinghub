-- Diagnostic query to check default_interface_id save issues
-- Run this to see the current state of workspace_settings and foreign key constraints

-- 1. Check if workspace_settings table exists and has default_interface_id column
SELECT 
  'Table/Column Check' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'workspace_settings' 
      AND column_name = 'default_interface_id'
    ) THEN 'Column exists'
    ELSE 'Column does NOT exist'
  END as status;

-- 2. Check current value in workspace_settings
SELECT 
  'Current Value' as check_type,
  id,
  default_interface_id,
  created_at,
  updated_at
FROM public.workspace_settings
LIMIT 1;

-- 3. Check foreign key constraint
SELECT 
  'Foreign Key Constraint' as check_type,
  tc.constraint_name,
  tc.table_name,
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

-- 4. Check if interface_pages table exists and has some pages
SELECT 
  'Interface Pages Check' as check_type,
  COUNT(*) as page_count,
  STRING_AGG(id::text, ', ') as page_ids
FROM public.interface_pages
LIMIT 10;

-- 5. Check RLS policies on workspace_settings
SELECT 
  'RLS Policies' as check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'workspace_settings';
