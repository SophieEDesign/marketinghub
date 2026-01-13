-- Comprehensive verification script for Core Data visibility
-- Run this after applying ensure_core_data_visible.sql migration

-- ============================================================================
-- 1. CHECK IF TABLES EXIST IN DATABASE
-- ============================================================================
SELECT 
  'Tables in database' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 0 THEN 'WARNING: No tables found in database'
    ELSE 'OK: Tables exist'
  END as status
FROM public.tables;

-- Show actual tables
SELECT 
  id,
  name,
  supabase_table,
  created_at,
  created_by,
  access_control
FROM public.tables
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- 2. CHECK RLS STATUS ON TABLES TABLE
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
  AND tablename = 'tables';

-- ============================================================================
-- 3. CHECK RLS POLICIES ON TABLES TABLE
-- ============================================================================
SELECT 
  'RLS Policies' as check_type,
  policyname,
  cmd as operation,
  roles,
  CASE 
    WHEN cmd = 'SELECT' AND 'authenticated' = ANY(roles) THEN 'OK: SELECT policy exists'
    WHEN cmd = 'INSERT' AND 'authenticated' = ANY(roles) THEN 'OK: INSERT policy exists'
    WHEN cmd = 'UPDATE' AND 'authenticated' = ANY(roles) THEN 'OK: UPDATE policy exists'
    WHEN cmd = 'DELETE' AND 'authenticated' = ANY(roles) THEN 'OK: DELETE policy exists'
    ELSE 'CHECK: Policy exists but may need verification'
  END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'tables'
ORDER BY cmd;

-- ============================================================================
-- 4. VERIFY SPECIFIC POLICY EXISTS
-- ============================================================================
SELECT 
  'Policy Verification' as check_type,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) > 0 THEN 'OK: "Authenticated users can view all tables" policy exists'
    ELSE 'ERROR: Required SELECT policy is missing'
  END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'tables'
  AND policyname = 'Authenticated users can view all tables';

-- ============================================================================
-- 5. CHECK TABLE_ROWS RLS POLICIES
-- ============================================================================
SELECT 
  'Table Rows RLS' as check_type,
  policyname,
  cmd as operation,
  CASE 
    WHEN cmd = 'SELECT' AND 'authenticated' = ANY(roles) THEN 'OK: SELECT policy exists'
    ELSE 'CHECK: Policy may need verification'
  END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'table_rows'
  AND cmd = 'SELECT'
LIMIT 1;

-- ============================================================================
-- 6. TEST QUERY (if running as authenticated user)
-- ============================================================================
-- This will only work if you're running as an authenticated user
-- If running as service role, this will always work regardless of RLS
SELECT 
  'Test Query' as check_type,
  COUNT(*) as accessible_tables,
  CASE 
    WHEN COUNT(*) > 0 THEN 'OK: Can query tables (RLS working)'
    ELSE 'WARNING: Cannot query tables (check RLS policies)'
  END as status
FROM public.tables;

-- ============================================================================
-- 7. CHECK FOR COMMON ISSUES
-- ============================================================================
-- Check if there are any conflicting policies
SELECT 
  'Policy Conflicts' as check_type,
  COUNT(DISTINCT policyname) as unique_policies,
  COUNT(*) as total_policies,
  CASE 
    WHEN COUNT(DISTINCT policyname) = COUNT(*) THEN 'OK: No duplicate policies'
    ELSE 'WARNING: Possible duplicate policies detected'
  END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'tables';

-- ============================================================================
-- SUMMARY
-- ============================================================================
SELECT 
  '=== SUMMARY ===' as summary,
  'Run all queries above to verify:' as instructions,
  '1. Tables exist in database' as step1,
  '2. RLS is enabled on tables table' as step2,
  '3. SELECT policy exists for authenticated users' as step3,
  '4. Test query can access tables' as step4;
