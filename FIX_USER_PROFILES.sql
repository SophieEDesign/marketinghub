-- Quick fix script to sync specific users or fix role issues
-- Run this in Supabase SQL Editor

-- Option 1: Create profiles for ALL users missing profiles (defaults to 'member' role)
-- This is safe to run multiple times (uses ON CONFLICT DO NOTHING)
INSERT INTO public.profiles (user_id, role)
SELECT 
  u.id,
  COALESCE(
    u.raw_user_meta_data->>'role',
    'member'
  )::text
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Option 2: Update a specific user's role (replace USER_ID and ROLE)
-- Example: Make user admin
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE user_id = 'YOUR_USER_ID_HERE';

-- Option 3: Fix all profiles with invalid roles (set to 'member')
UPDATE public.profiles
SET role = 'member'
WHERE role IS NULL 
   OR role NOT IN ('admin', 'member');

-- Option 4: Sync roles from user metadata to profiles
-- This updates profiles with roles from auth.users metadata
UPDATE public.profiles p
SET role = COALESCE(
  u.raw_user_meta_data->>'role',
  p.role
)::text
FROM auth.users u
WHERE u.id = p.user_id
  AND u.raw_user_meta_data->>'role' IS NOT NULL
  AND u.raw_user_meta_data->>'role' IN ('admin', 'member')
  AND u.raw_user_meta_data->>'role' != p.role;

-- Option 5: Make the first user (oldest) an admin if no admins exist
-- This ensures at least one admin exists
DO $$
DECLARE
  admin_count INTEGER;
  first_user_id UUID;
BEGIN
  -- Check if any admins exist
  SELECT COUNT(*) INTO admin_count
  FROM public.profiles
  WHERE role = 'admin';
  
  -- If no admins, make the first user an admin
  IF admin_count = 0 THEN
    SELECT id INTO first_user_id
    FROM auth.users
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF first_user_id IS NOT NULL THEN
      -- Create or update profile for first user
      INSERT INTO public.profiles (user_id, role)
      VALUES (first_user_id, 'admin')
      ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
      
      RAISE NOTICE 'Made first user (ID: %) an admin', first_user_id;
    END IF;
  END IF;
END $$;

-- Verify the fix worked
SELECT 
  u.email,
  p.role,
  u.created_at,
  CASE 
    WHEN p.id IS NULL THEN '❌ Still missing profile'
    ELSE '✅ Profile exists'
  END as status
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
ORDER BY u.created_at DESC;
