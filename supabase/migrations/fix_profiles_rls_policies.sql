-- Migration: Fix overly permissive RLS policies on profiles table
-- This ensures only admins can update profiles, not all authenticated users

-- 1. Ensure is_admin function exists with the correct signature
-- This function should already exist from add_profiles_and_branding.sql
-- We need to drop any conflicting versions and ensure only one signature exists
-- The function accepts an optional uid parameter (defaults to current user)

-- Drop all possible versions of is_admin to avoid ambiguity
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;

-- Create function with optional parameter (matches add_profiles_and_branding.sql)
-- This is the canonical version that should be used everywhere
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role text;
BEGIN
  -- Get the user's role from profiles table
  SELECT role INTO user_role
  FROM public.profiles
  WHERE user_id = uid;
  
  -- Return true if role is 'admin', false otherwise
  RETURN COALESCE(user_role = 'admin', false);
END;
$$;

-- 2. Drop existing overly permissive policies
-- Drop all possible policy names that might exist from previous migrations
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile non-role fields" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- 3. Note: This migration drops old policies but does NOT create new ones
-- The add_profiles_and_branding.sql migration creates the final hardened policies
-- with proper role escalation prevention (trigger + RLS). This migration just
-- ensures the is_admin() function exists and drops old overly-permissive policies.

-- 4. Fix workspace_settings RLS policies similarly
-- Use the existing is_admin() function instead of creating a duplicate
-- Drop the duplicate function if it exists
DROP FUNCTION IF EXISTS public.is_admin_for_workspace();

-- Drop existing overly permissive policies
-- Drop all possible policy names that might exist from previous migrations
DROP POLICY IF EXISTS "Admins can update workspace settings" ON public.workspace_settings;
DROP POLICY IF EXISTS "Only admins can update workspace settings" ON public.workspace_settings;
DROP POLICY IF EXISTS "Admins can insert workspace settings" ON public.workspace_settings;
DROP POLICY IF EXISTS "Only admins can insert workspace settings" ON public.workspace_settings;

-- Note: This migration drops old policies but does NOT create new ones
-- The add_profiles_and_branding.sql migration creates the final hardened policies
-- for workspace_settings with proper admin checks.
