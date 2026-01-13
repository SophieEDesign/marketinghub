-- Add admin user by email: sue.edgerley@petersandmay.com
-- This script finds the user by email and sets their role to 'admin' in the profiles table
--
-- IMPORTANT: After running this SQL, the user needs to receive a password reset email
-- to set their password. Use one of the following methods:
--
-- Method 1: Use the reinvite API endpoint (recommended)
--   - Go to Settings → Users in the app
--   - Find the user and click "Reinvite"
--   - This will send them a password setup email
--
-- Method 2: Use Supabase Admin API directly
--   - Use the Supabase Admin API to send a password reset email:
--   - POST to: https://YOUR_PROJECT.supabase.co/auth/v1/recover
--   - Body: { "email": "sue.edgerley@petersandmay.com" }
--   - Or use generateLink with type 'recovery' via Admin API
--
-- Method 3: Use the password reset endpoint in the app
--   - The user can go to /login and click "Forgot password"
--   - They will receive a password reset email

-- Insert or update the user's profile to admin role
INSERT INTO public.profiles (user_id, role)
SELECT 
  u.id,
  'admin'
FROM auth.users u
WHERE u.email = 'sue.edgerley@petersandmay.com'
ON CONFLICT (user_id) 
DO UPDATE SET 
  role = 'admin',
  updated_at = NOW();

-- Verify the user was added/updated as admin
SELECT 
  p.user_id,
  u.id as auth_user_id,
  p.role,
  u.email,
  u.created_at as user_created_at,
  p.created_at as profile_created_at,
  p.updated_at as profile_updated_at,
  CASE 
    WHEN u.encrypted_password IS NULL OR u.encrypted_password = '' THEN 'No password set - user needs password reset email'
    ELSE 'Password is set'
  END as password_status
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE u.email = 'sue.edgerley@petersandmay.com';
