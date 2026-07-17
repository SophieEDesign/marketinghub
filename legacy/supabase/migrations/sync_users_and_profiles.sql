-- Migration: Sync auth.users with profiles table and auto-create profiles
-- This ensures all users in auth.users have corresponding profiles with correct roles

-- 1. Create a function to handle new user creation (auto-create profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-create profile for new user with default role 'member'
  -- Role can be updated later by admins
  INSERT INTO public.profiles (user_id, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'role', 'member'))
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- 2. Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Create trigger to auto-create profile when user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Sync existing auth.users to profiles table
-- This ensures all existing users have profiles
-- Users without profiles will get 'member' role by default
INSERT INTO public.profiles (user_id, role)
SELECT 
  u.id,
  COALESCE(
    -- First, try to get role from existing profile
    (SELECT p.role FROM public.profiles p WHERE p.user_id = u.id),
    -- Then, try to get role from user metadata
    COALESCE(
      u.raw_user_meta_data->>'role',
      -- Finally, default to 'member' for security
      'member'
    )
  )::text
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- 5. Update profiles with roles from user_metadata if they exist
-- This syncs any roles that were set in user metadata but not in profiles
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

-- 6. Ensure all profiles have valid roles (admin or member)
-- Fix any invalid roles by defaulting to 'member'
UPDATE public.profiles
SET role = 'member'
WHERE role IS NULL 
   OR role NOT IN ('admin', 'member');

-- 7. Create a view to help diagnose user/profile mismatches
CREATE OR REPLACE VIEW public.user_profile_sync_status AS
SELECT 
  u.id as user_id,
  u.email,
  u.created_at as user_created_at,
  u.last_sign_in_at,
  CASE 
    WHEN p.id IS NULL THEN 'missing_profile'
    ELSE 'has_profile'
  END as profile_status,
  p.role,
  p.created_at as profile_created_at,
  u.raw_user_meta_data->>'role' as metadata_role
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
ORDER BY u.created_at DESC;

-- 8. Grant access to the view for authenticated users
GRANT SELECT ON public.user_profile_sync_status TO authenticated;

-- 9. Ensure INSERT policies exist for profiles (in case they were dropped)
-- These policies allow the trigger to work properly
-- Note: The trigger uses SECURITY DEFINER so it bypasses RLS, but policies are good for manual inserts

-- Drop and recreate INSERT policies to ensure they exist
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

-- Users can insert their own profile with role='member' only
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      role = 'member'
      OR role IS NULL  -- Will default to 'member' via DEFAULT constraint
    )
  );

-- Admins can insert any profile
CREATE POLICY "Admins can insert profiles"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- 10. Add helpful comments
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a profile entry when a new user is created in auth.users. Uses SECURITY DEFINER to bypass RLS.';
COMMENT ON VIEW public.user_profile_sync_status IS 'Shows sync status between auth.users and profiles table for troubleshooting';
