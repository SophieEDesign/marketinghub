-- Detailed diagnostic for DELETE policy on table_fields
-- Run this to see the exact policy configuration and potential blockers

-- ============================================================================
-- 1. SHOW EXACT DELETE POLICY CONFIGURATION
-- ============================================================================
SELECT 
  'DELETE Policy Details' as check_type,
  policyname,
  cmd as operation,
  roles,
  qual as using_expression,
  with_check as with_check_expression,
  CASE 
    WHEN qual IS NULL OR qual = '' THEN 'WARNING: USING clause is empty or NULL'
    WHEN qual = 'true' THEN 'OK: USING clause allows all rows'
    ELSE 'CHECK: USING clause has condition: ' || qual
  END as using_status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'table_fields'
  AND cmd = 'DELETE';

-- ============================================================================
-- 2. CHECK ALL POLICIES ON table_fields (to see if there are conflicts)
-- ============================================================================
SELECT 
  'All Policies' as check_type,
  policyname,
  cmd as operation,
  roles,
  CASE 
    WHEN cmd = 'DELETE' THEN 'DELETE policy'
    WHEN cmd = 'SELECT' THEN 'SELECT policy'
    WHEN cmd = 'INSERT' THEN 'INSERT policy'
    WHEN cmd = 'UPDATE' THEN 'UPDATE policy'
    ELSE 'Other policy'
  END as policy_type
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'table_fields'
ORDER BY cmd, policyname;

-- ============================================================================
-- 3. CHECK TABLE PRIVILEGES (these are required even with RLS policies)
-- ============================================================================
SELECT 
  'Table Privileges' as check_type,
  grantee,
  privilege_type,
  is_grantable,
  CASE 
    WHEN privilege_type = 'DELETE' AND grantee = 'authenticated' THEN 'OK: DELETE privilege granted to authenticated'
    WHEN privilege_type = 'DELETE' THEN 'CHECK: DELETE privilege granted to ' || grantee
    ELSE 'Other privilege: ' || privilege_type
  END as status
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND table_name = 'table_fields'
  AND privilege_type = 'DELETE'
ORDER BY grantee;

-- ============================================================================
-- 4. CHECK FOR TRIGGERS THAT MIGHT BLOCK DELETES
-- ============================================================================
SELECT 
  'DELETE Triggers' as check_type,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement,
  CASE 
    WHEN event_manipulation = 'DELETE' AND action_timing = 'BEFORE' THEN 'WARNING: BEFORE DELETE trigger exists - may block or modify deletes'
    WHEN event_manipulation = 'DELETE' THEN 'INFO: DELETE trigger exists'
    ELSE 'Other trigger'
  END as status
FROM information_schema.triggers
WHERE event_object_schema = 'public' 
  AND event_object_table = 'table_fields'
  AND event_manipulation = 'DELETE';

-- ============================================================================
-- 5. CHECK CURRENT USER ROLE (to verify you're authenticated)
-- ============================================================================
SELECT 
  'Current User Role' as check_type,
  current_user as database_user,
  session_user as session_user,
  current_setting('role') as current_role,
  CASE 
    WHEN current_setting('role') = 'authenticated' THEN 'OK: Running as authenticated role'
    ELSE 'CHECK: Running as ' || current_setting('role')
  END as status;

-- ============================================================================
-- 6. TEST DELETE POLICY DIRECTLY (this will show if policy works)
-- ============================================================================
-- WARNING: This is a read-only test - it won't actually delete anything
-- Replace 'YOUR_FIELD_ID_HERE' with an actual field ID to test
/*
SELECT 
  'Policy Test' as check_type,
  id,
  name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'table_fields'
        AND cmd = 'DELETE'
        AND 'authenticated' = ANY(roles)
        AND (
          qual IS NULL 
          OR qual = 'true' 
          OR qual = ''
        )
    ) THEN 'Policy should allow delete'
    ELSE 'Policy may block delete'
  END as policy_check
FROM public.table_fields
WHERE id = 'YOUR_FIELD_ID_HERE'::uuid
LIMIT 1;
*/
