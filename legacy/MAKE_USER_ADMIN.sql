-- Make current user an admin
-- Run this in Supabase SQL Editor while logged in

-- Option 1: If you know your user ID (from auth.users table)
-- Replace 'YOUR_USER_ID_HERE' with your actual user ID
-- INSERT INTO profiles (user_id, role)
-- VALUES ('YOUR_USER_ID_HERE', 'admin')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- Option 2: Make yourself admin using auth.uid() (recommended)
-- This automatically uses your current logged-in user ID
-- Note: auth.uid() may not work in SQL Editor - use Option 1 with your user ID instead

-- Option 2a: Use your specific user ID (replace with your actual user ID)
INSERT INTO profiles (user_id, role)
VALUES ('88f45fb1-c7d3-42cc-aaf0-d1e2471c5821', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- Option 3: Make the first user in auth.users an admin (if profiles table is empty)
-- INSERT INTO profiles (user_id, role)
-- SELECT id, 'admin'
-- FROM auth.users
-- ORDER BY created_at ASC
-- LIMIT 1
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- Verify it worked:
SELECT 
  p.user_id,
  p.role,
  u.email
FROM profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE p.role = 'admin';
