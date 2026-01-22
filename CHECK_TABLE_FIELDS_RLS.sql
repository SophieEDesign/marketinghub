-- Diagnostic script to check table_fields RLS policies and permissions
-- Run this in your Supabase SQL editor to diagnose field deletion issues

-- ============================================================================
-- 1. CHECK IF TABLE EXISTS
-- ============================================================================
SELECT 
  'Table Exists' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'table_fields')
    THEN 'OK: table_fields table exists'
    ELSE 'ERROR: table_fields table does not exist'
  END as status;

-- ============================================================================
-- 2. CHECK RLS STATUS
-- ============================================================================
SELECT 
  'RLS Status' as check_type,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity = true THEN 'OK: RLS is enabled'
    ELSE 'ERROR: RLS is NOT enabled'
  END as status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'table_fields';

-- ============================================================================
-- 3. CHECK ALL RLS POLICIES ON table_fields
-- ============================================================================
SELECT 
  'RLS Policies' as check_type,
  policyname,
  cmd as operation,
  roles,
  qual as using_expression,
  with_check as with_check_expression,
  CASE 
    WHEN cmd = 'DELETE' AND 'authenticated' = ANY(roles) THEN 'OK: DELETE policy exists for authenticated'
    WHEN cmd = 'SELECT' AND 'authenticated' = ANY(roles) THEN 'OK: SELECT policy exists'
    WHEN cmd = 'INSERT' AND 'authenticated' = ANY(roles) THEN 'OK: INSERT policy exists'
    WHEN cmd = 'UPDATE' AND 'authenticated' = ANY(roles) THEN 'OK: UPDATE policy exists'
    ELSE 'CHECK: Policy exists but may need verification'
  END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'table_fields'
ORDER BY cmd;

-- ============================================================================
-- 4. CHECK SPECIFIC DELETE POLICY
-- ============================================================================
SELECT 
  'DELETE Policy Check' as check_type,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) > 0 THEN 'OK: DELETE policy exists'
    ELSE 'ERROR: DELETE policy is MISSING - Run ensure_table_fields_delete_rls.sql migration'
  END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'table_fields'
  AND cmd = 'DELETE'
  AND 'authenticated' = ANY(roles);

-- ============================================================================
-- 5. CHECK TABLE PRIVILEGES
-- ============================================================================
SELECT 
  'Table Privileges' as check_type,
  grantee,
  privilege_type,
  CASE 
    WHEN privilege_type = 'DELETE' THEN 'OK: DELETE privilege granted'
    ELSE 'CHECK: Other privilege'
  END as status
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND table_name = 'table_fields'
  AND grantee = 'authenticated'
ORDER BY privilege_type;

-- ============================================================================
-- 6. CHECK FOR TRIGGERS THAT MIGHT BLOCK DELETES
-- ============================================================================
SELECT 
  'Triggers' as check_type,
  trigger_name,
  event_manipulation,
  action_statement,
  CASE 
    WHEN event_manipulation = 'DELETE' THEN 'WARNING: DELETE trigger exists - may block deletes'
    ELSE 'INFO: Trigger exists'
  END as status
FROM information_schema.triggers
WHERE event_object_schema = 'public' 
  AND event_object_table = 'table_fields'
  AND event_manipulation = 'DELETE';

-- ============================================================================
-- 7. TEST QUERY (if running as authenticated user)
-- ============================================================================
SELECT 
  'Test Query' as check_type,
  COUNT(*) as accessible_fields,
  CASE 
    WHEN COUNT(*) >= 0 THEN 'OK: Can query table_fields (RLS working for SELECT)'
    ELSE 'ERROR: Cannot query table_fields'
  END as status
FROM public.table_fields
LIMIT 1;
