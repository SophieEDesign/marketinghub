# User Profile Synchronization Fix

## Problem
You're experiencing two issues:
1. **Only seeing "admin" in roles** - This suggests either:
   - All users have admin role incorrectly set
   - Only admin users have profiles, and other users are missing profiles
   
2. **Users in authentication aren't the same as in users table** - This means:
   - Some users exist in `auth.users` but don't have entries in `profiles` table
   - The profiles table is out of sync with authentication

## Root Cause
The system uses a `profiles` table to store user roles (admin/member), but:
- There's no automatic trigger to create profiles when users are added to `auth.users`
- Existing users may not have profiles if they were created before the profiles system was implemented
- Profiles are only created when users accept email invitations, not when users are created directly

## Solution

### Step 1: Run the Diagnostic Query
First, check the current state by running `CHECK_USERS_AND_PROFILES.sql` in Supabase SQL Editor:
- This will show you which users are missing profiles
- It will show role mismatches
- It will help you understand the scope of the issue

### Step 2: Run the Sync Migration
Run `supabase/migrations/sync_users_and_profiles.sql` in Supabase SQL Editor:
- This creates a trigger to auto-create profiles for new users
- It syncs all existing `auth.users` to the `profiles` table
- It ensures all users have valid roles (admin or member)
- It creates a diagnostic view for future troubleshooting

### Step 3: Verify the Fix
After running the migration, run the diagnostic query again to verify:
- All users should now have profiles
- Roles should be correctly set (defaults to 'member' for security)
- The `user_profile_sync_status` view should show all users as 'has_profile'

### Step 4: Fix Roles (if needed)
If you need to change specific user roles, you can:
1. Use the Users tab in the application (if you're an admin)
2. Run `FIX_USER_PROFILES.sql` with specific user IDs
3. Or use the SQL editor to update specific users:
   ```sql
   UPDATE public.profiles
   SET role = 'admin'  -- or 'member'
   WHERE user_id = 'USER_ID_HERE';
   ```

## Files Created

1. **`supabase/migrations/sync_users_and_profiles.sql`**
   - Main migration that fixes the sync issue
   - Creates trigger for future users
   - Syncs existing users

2. **`CHECK_USERS_AND_PROFILES.sql`**
   - Diagnostic queries to check current state
   - Run this before and after the fix to verify

3. **`FIX_USER_PROFILES.sql`**
   - Quick fix scripts for manual intervention
   - Can be used to fix specific users or bulk operations

## Important Notes

- **Default Role**: New users and users without profiles will default to `'member'` role for security
- **Admin Access**: At least one user should have `'admin'` role. If no admins exist, the migration will make the first (oldest) user an admin
- **Trigger**: The new trigger automatically creates profiles for all future users, so this issue shouldn't happen again
- **RLS Policies**: The migration ensures proper RLS policies are in place for profile management

## Troubleshooting

### If you still see issues after running the migration:

1. **Check RLS policies**: Ensure the profiles table has proper SELECT policies
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'profiles';
   ```

2. **Check trigger exists**: 
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
   ```

3. **Manually sync a specific user**:
   ```sql
   INSERT INTO public.profiles (user_id, role)
   VALUES ('USER_ID_HERE', 'member')
   ON CONFLICT (user_id) DO UPDATE SET role = 'member';
   ```

4. **View sync status**:
   ```sql
   SELECT * FROM public.user_profile_sync_status;
   ```

## Security Considerations

- Users default to `'member'` role (not admin) for security
- Only admins can update roles through the application
- The trigger uses `SECURITY DEFINER` to bypass RLS, which is necessary for automatic profile creation
- Role escalation is prevented by triggers and RLS policies
