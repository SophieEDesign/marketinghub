-- Migration: Add default_interface_id to workspace_settings
-- This enables storing the default interface that users are redirected to on login

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'workspace_settings' 
    AND column_name = 'default_interface_id'
  ) THEN
    ALTER TABLE public.workspace_settings
      ADD COLUMN default_interface_id uuid REFERENCES public.views(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_workspace_settings_default_interface 
      ON public.workspace_settings(default_interface_id);
    
    COMMENT ON COLUMN public.workspace_settings.default_interface_id IS 
      'Default interface (view with type=interface) that users are redirected to on login';
  END IF;
END $$;
