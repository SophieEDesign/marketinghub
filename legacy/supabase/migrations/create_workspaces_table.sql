-- Migration: Create workspaces table for workspace settings
-- This table stores workspace-level settings (name, icon) separate from branding settings

-- Workspaces: Single workspace configuration
CREATE TABLE IF NOT EXISTS public.workspaces (
  id text PRIMARY KEY DEFAULT 'default',
  name text NOT NULL DEFAULT 'Marketing Hub',
  icon text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Insert default workspace if it doesn't exist
INSERT INTO public.workspaces (id, name, icon)
VALUES ('default', 'Marketing Hub', '📊')
ON CONFLICT (id) DO NOTHING;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_workspaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_workspaces_updated_at();

-- RLS Policies (allow authenticated users to read/update/insert)
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Allow authenticated users to read workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Allow authenticated users to update workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Allow authenticated users to insert workspace" ON public.workspaces;

CREATE POLICY "Allow authenticated users to read workspace"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to update workspace"
  ON public.workspaces FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert workspace"
  ON public.workspaces FOR INSERT
  TO authenticated
  WITH CHECK (true);
