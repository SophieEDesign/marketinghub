-- Check if a specific user is an admin
-- Replace 'USER_EMAIL_HERE' with your actual email address

-- Method 1: Check profiles table (new system)
SELECT 
  'Profile Check' as check_type,
  p.user_id,
  p.role,
  u.email,
  CASE 
    WHEN p.role = 'admin' THEN 'OK: User is admin in profiles table'
    WHEN p.role = 'member' THEN 'INFO: User is member (not admin)'
    ELSE 'CHECK: Unknown role'
  END as status
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE u.email = 'USER_EMAIL_HERE'  -- Replace with your email
LIMIT 1;

-- Method 2: Check user_roles table (legacy system)
SELECT 
  'Legacy Role Check' as check_type,
  ur.user_id,
  ur.role,
  u.email,
  CASE 
    WHEN ur.role IN ('admin', 'editor') THEN 'OK: User is admin/editor in user_roles table'
    WHEN ur.role = 'viewer' THEN 'INFO: User is viewer (not admin)'
    ELSE 'CHECK: Unknown role'
  END as status
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = 'USER_EMAIL_HERE'  -- Replace with your email
LIMIT 1;

-- Method 3: List all admins
SELECT 
  'All Admins' as check_type,
  u.email,
  COALESCE(p.role, ur.role, 'unknown') as role,
  CASE 
    WHEN p.role = 'admin' OR ur.role IN ('admin', 'editor') THEN 'Admin'
    ELSE 'Not Admin'
  END as admin_status
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE p.role = 'admin' OR ur.role IN ('admin', 'editor')
ORDER BY u.email;
