# Production Error Fixes

## Summary
This document outlines the fixes for production errors identified in the Vercel logs.

## Issues Identified

### 1. Missing Database Tables
**Error**: `Could not find the table 'public.favorites' in the schema cache` and `Could not find the table 'public.recent_items' in the schema cache`

**Root Cause**: The migration file `create_product_glue.sql` exists in `baserow-app/supabase/migrations/` but hasn't been applied to production. The tables don't exist in the production database.

**Fix**: Created migration file `supabase/migrations/create_recents_and_favorites.sql` that:
- Creates `recent_items` table with proper indexes and RLS policies
- Creates `favorites` table with proper indexes and RLS policies
- Creates `upsert_recent_item()` function with proper permissions
- Creates `cleanup_old_recent_items()` function
- Sets up trigger for automatic cleanup

### 2. Missing Database Function
**Error**: `Could not find the function public.upsert_recent_item(p_entity_id, p_entity_type, p_user_id) in the schema cache`

**Root Cause**: The function doesn't exist because the tables don't exist (see issue #1). Once the migration is applied, this will be resolved.

**Fix**: The migration includes the function with proper signature and grants execute permission to authenticated users.

### 3. Row-Level Security Policy Violation
**Error**: `new row violates row-level security policy for table "profiles"`

**Root Cause**: In `/api/users/invite`, profile creation was using the regular Supabase client (`createClient()`) instead of the admin client (`createAdminClient()`), which bypasses RLS policies.

**Fix**: Updated `baserow-app/app/api/users/invite/route.ts` to use `adminClient` instead of `createClient()` for profile creation (line 143).

### 4. Email Already Exists Error
**Error**: `A user with this email address has already been registered`

**Status**: This is expected behavior - the API already handles this correctly by returning a 400 status with an appropriate error message. No fix needed.

## Files Changed

1. **Created**: `supabase/migrations/create_recents_and_favorites.sql`
   - Migration to create recents and favorites tables
   - Includes all necessary RLS policies, indexes, functions, and triggers

2. **Modified**: `baserow-app/app/api/users/invite/route.ts`
   - Changed profile creation to use admin client instead of regular client
   - This bypasses RLS policies when creating profiles for invited users

## Deployment Steps

1. **Apply Database Migration**:
   - Run the migration file `supabase/migrations/create_recents_and_favorites.sql` against your production Supabase database
   - This can be done via:
     - Supabase Dashboard → SQL Editor
     - Supabase CLI: `supabase db push`
     - Or manually executing the SQL

2. **Deploy Code Changes**:
   - The fix to `baserow-app/app/api/users/invite/route.ts` will be deployed automatically with your next deployment
   - Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel environment variables

3. **Verify**:
   - Check that `/api/favorites` and `/api/recents` endpoints work without errors
   - Verify that user invitations create profiles successfully
   - Check Vercel logs to confirm errors are resolved

## Testing Checklist

- [ ] Migration applied successfully
- [ ] `recent_items` table exists and has RLS policies
- [ ] `favorites` table exists and has RLS policies
- [ ] `upsert_recent_item()` function exists and is callable
- [ ] `/api/favorites` endpoint returns data without errors
- [ ] `/api/recents` endpoint returns data without errors
- [ ] `/api/recents` POST endpoint successfully records items
- [ ] User invitation creates profile without RLS errors
- [ ] No errors in Vercel logs for favorites/recents endpoints

## Notes

- The migration uses `IF NOT EXISTS` clauses to make it safe to run multiple times
- All tables and functions are in the `public` schema
- RLS policies ensure users can only access their own recents/favorites
- The `upsert_recent_item` function uses `SECURITY DEFINER` to bypass RLS when inserting/updating recent items
- The cleanup trigger automatically removes old recent items, keeping only the 50 most recent per user

