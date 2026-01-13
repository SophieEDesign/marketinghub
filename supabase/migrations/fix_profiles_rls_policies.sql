-- Migration: Fix overly permissive RLS policies on profiles table
-- This ensures only admins can update profiles, not all authenticated users

-- 1. Create a function to check if a user is an admin
-- This function checks the profiles table to determine if the current user has admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role text;
BEGIN
  -- Get the current user's role from profiles table
  SELECT role INTO user_role
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  -- Return true if role is 'admin', false otherwise
  RETURN COALESCE(user_role = 'admin', false);
END;
$$;

-- 2. Drop existing overly permissive policies
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

-- 3. Create proper RLS policies that check admin role at database level
-- Only admins can update profiles (including role changes)
CREATE POLICY "Only admins can update profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Only admins can insert new profiles
CREATE POLICY "Only admins can insert profiles"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Note: The SELECT policies remain unchanged as they allow users to read their own profile
-- and all profiles (needed for role checking). These are safe as they don't allow modifications.

-- 4. Fix workspace_settings RLS policies similarly
-- Create function to check admin for workspace settings
CREATE OR REPLACE FUNCTION public.is_admin_for_workspace()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  RETURN COALESCE(user_role = 'admin', false);
END;
$$;

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Admins can update workspace settings" ON public.workspace_settings;
DROP POLICY IF EXISTS "Admins can insert workspace settings" ON public.workspace_settings;

-- Create proper RLS policies for workspace settings
CREATE POLICY "Only admins can update workspace settings"
  ON public.workspace_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_for_workspace())
  WITH CHECK (public.is_admin_for_workspace());

CREATE POLICY "Only admins can insert workspace settings"
  ON public.workspace_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_for_workspace());

-- Note: SELECT policy remains unchanged - all authenticated users can read workspace settings
-- (needed for branding display on login page)
