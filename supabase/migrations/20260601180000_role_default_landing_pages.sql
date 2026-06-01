-- Separate workspace default landing pages for admins vs members.
-- Keeps default_interface_id as legacy fallback for older app versions.

ALTER TABLE public.workspace_settings
  ADD COLUMN IF NOT EXISTS admin_default_interface_id uuid,
  ADD COLUMN IF NOT EXISTS member_default_interface_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workspace_settings_admin_default_interface_id_fkey'
  ) THEN
    ALTER TABLE public.workspace_settings
      ADD CONSTRAINT workspace_settings_admin_default_interface_id_fkey
      FOREIGN KEY (admin_default_interface_id)
      REFERENCES public.interface_pages(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workspace_settings_member_default_interface_id_fkey'
  ) THEN
    ALTER TABLE public.workspace_settings
      ADD CONSTRAINT workspace_settings_member_default_interface_id_fkey
      FOREIGN KEY (member_default_interface_id)
      REFERENCES public.interface_pages(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workspace_settings_admin_default_interface_id
  ON public.workspace_settings(admin_default_interface_id)
  WHERE admin_default_interface_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_settings_member_default_interface_id
  ON public.workspace_settings(member_default_interface_id)
  WHERE member_default_interface_id IS NOT NULL;

COMMENT ON COLUMN public.workspace_settings.admin_default_interface_id IS
  'Landing page for admin users after login (when no per-user default is set).';

COMMENT ON COLUMN public.workspace_settings.member_default_interface_id IS
  'Landing page for member users after login (when no per-user default is set).';

-- Backfill from legacy single default
UPDATE public.workspace_settings
SET
  admin_default_interface_id = COALESCE(admin_default_interface_id, default_interface_id),
  member_default_interface_id = COALESCE(member_default_interface_id, default_interface_id)
WHERE default_interface_id IS NOT NULL;
