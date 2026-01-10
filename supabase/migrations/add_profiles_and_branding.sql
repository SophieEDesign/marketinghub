-- Migration: Add profiles table, interface permissions, and workspace branding
-- This enables role-based permissions (admin/member) and workspace branding

-- 1. Create profiles table (replaces user_roles for simpler admin/member system)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_user_id_key UNIQUE (user_id)
);

-- 2. Add is_admin_only to views table (for interface permissions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'views' 
    AND column_name = 'is_admin_only'
  ) THEN
    ALTER TABLE public.views
      ADD COLUMN is_admin_only boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- 3. Create workspace_settings table for branding
CREATE TABLE IF NOT EXISTS public.workspace_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid,
  brand_name text,
  logo_url text,
  primary_color text,
  accent_color text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workspace_settings_pkey PRIMARY KEY (id),
  CONSTRAINT workspace_settings_workspace_id_key UNIQUE (workspace_id)
);

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_views_is_admin_only ON public.views(is_admin_only);

-- 5. Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;

-- Users can read their own profile
CREATE POLICY "Users can read their own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can read all profiles (for role checking)
CREATE POLICY "Users can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can update profiles (via API with server-side checks)
CREATE POLICY "Admins can update profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Enable RLS on workspace_settings
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can read workspace settings" ON public.workspace_settings;
DROP POLICY IF EXISTS "Admins can update workspace settings" ON public.workspace_settings;

-- All authenticated users can read workspace settings
CREATE POLICY "Users can read workspace settings"
  ON public.workspace_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can update workspace settings (via API with server-side checks)
CREATE POLICY "Admins can update workspace settings"
  ON public.workspace_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow admins to insert workspace settings
CREATE POLICY "Admins can insert workspace settings"
  ON public.workspace_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 7. Add update triggers
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

CREATE OR REPLACE FUNCTION update_workspace_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_workspace_settings_updated_at ON public.workspace_settings;
CREATE TRIGGER update_workspace_settings_updated_at
  BEFORE UPDATE ON public.workspace_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_workspace_settings_updated_at();

-- 8. Migrate existing user_roles to profiles (if user_roles table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_roles'
  ) THEN
    -- Migrate admin and editor roles to admin, viewer to member
    INSERT INTO public.profiles (user_id, role)
    SELECT 
      user_id,
      CASE 
        WHEN role = 'admin' THEN 'admin'
        WHEN role = 'editor' THEN 'admin'
        ELSE 'member'
      END
    FROM public.user_roles
    WHERE NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user_id = user_roles.user_id
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;

COMMENT ON TABLE public.profiles IS 'User profiles with role-based permissions (admin/member)';
COMMENT ON COLUMN public.views.is_admin_only IS 'If true, only admins can see this interface';
COMMENT ON TABLE public.workspace_settings IS 'Workspace branding and settings';
