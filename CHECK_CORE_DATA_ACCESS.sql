-- Diagnostic script to check Core Data access issues
-- Run this in Supabase SQL editor to diagnose why tables aren't showing

-- ============================================================================
-- 1. CHECK IF TABLES EXIST IN DATABASE
-- ============================================================================
SELECT 
  id,
  name,
  supabase_table,
  created_at,
  created_by
FROM public.tables
ORDER BY created_at DESC;

-- ============================================================================
-- 2. CHECK RLS POLICIES ON TABLES TABLE
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'tables'
ORDER BY policyname;

-- ============================================================================
-- 3. CHECK IF RLS IS ENABLED
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'tables';

-- ============================================================================
-- 4. CHECK CURRENT USER AND ROLE
-- ============================================================================
SELECT 
  auth.uid() as current_user_id,
  auth.role() as current_role;

-- ============================================================================
-- 5. TEST QUERY AS AUTHENTICATED USER (if running as service role, this won't work)
-- ============================================================================
-- This should return rows if RLS policies are correct
-- SELECT * FROM public.tables LIMIT 5;

-- ============================================================================
-- 6. CHECK FOR ANY ERRORS IN RECENT MIGRATIONS
-- ============================================================================
-- Check if the migration was applied by looking for the policy
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'tables'
  AND policyname = 'Authenticated users can view all tables';
