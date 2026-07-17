-- Migration: Allow anonymous users to read workspace_settings for branding
-- This enables the login page to display branding without requiring authentication

-- Allow anonymous users to read workspace settings (for branding on login page)
DROP POLICY IF EXISTS "Allow anonymous users to read workspace settings" ON public.workspace_settings;

CREATE POLICY "Allow anonymous users to read workspace settings"
  ON public.workspace_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);
