-- Diagnostic queries to check user and profile synchronization
-- Run these in Supabase SQL Editor to see the current state

-- 1. Check all users in auth.users
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at,
  raw_user_meta_data->>'role' as metadata_role,
  raw_user_meta_data->>'name' as metadata_name
FROM auth.users
ORDER BY created_at DESC;

-- 2. Check all profiles
SELECT 
  id,
  user_id,
  role,
  created_at,
  updated_at
FROM public.profiles
ORDER BY created_at DESC;

-- 3. Check users without profiles (these need to be synced)
SELECT 
  u.id,
  u.email,
  u.created_at,
  u.last_sign_in_at,
  'MISSING PROFILE' as status
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;

-- 4. Check profiles without matching auth.users (orphaned profiles)
SELECT 
  p.id,
  p.user_id,
  p.role,
  p.created_at,
  'ORPHANED PROFILE - User deleted from auth.users' as status
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.user_id
WHERE u.id IS NULL
ORDER BY p.created_at DESC;

-- 5. Full sync status view (if migration has been run)
SELECT * FROM public.user_profile_sync_status
ORDER BY user_created_at DESC;

-- 6. Count users by role
SELECT 
  COALESCE(p.role, 'NO PROFILE') as role,
  COUNT(*) as count
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
GROUP BY p.role
ORDER BY count DESC;

-- 7. Detailed user/profile comparison
SELECT 
  u.id as user_id,
  u.email,
  u.created_at as user_created_at,
  u.last_sign_in_at,
  CASE 
    WHEN p.id IS NULL THEN '❌ Missing Profile'
    ELSE '✅ Has Profile'
  END as profile_status,
  COALESCE(p.role, 'NO PROFILE') as profile_role,
  u.raw_user_meta_data->>'role' as metadata_role,
  CASE 
    WHEN p.id IS NULL THEN 'ACTION NEEDED: Run sync migration'
    WHEN p.role != COALESCE(u.raw_user_meta_data->>'role', 'member') THEN '⚠️ Role mismatch'
    ELSE '✅ OK'
  END as sync_status
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
ORDER BY u.created_at DESC;
