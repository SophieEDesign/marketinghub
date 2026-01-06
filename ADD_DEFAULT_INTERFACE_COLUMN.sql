-- Quick fix: Add default_interface_id column to workspace_settings
-- Run this directly in Supabase SQL Editor if the migration hasn't been applied

-- Check if column exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'workspace_settings' 
    AND column_name = 'default_interface_id'
  ) THEN
    -- Add the column
    ALTER TABLE public.workspace_settings
      ADD COLUMN default_interface_id uuid REFERENCES public.views(id) ON DELETE SET NULL;
    
    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_workspace_settings_default_interface 
      ON public.workspace_settings(default_interface_id);
    
    -- Add comment
    COMMENT ON COLUMN public.workspace_settings.default_interface_id IS 
      'Default interface (view with type=interface) that users are redirected to on login';
    
    RAISE NOTICE 'Column default_interface_id added successfully';
  ELSE
    RAISE NOTICE 'Column default_interface_id already exists';
  END IF;
END $$;

-- Verify the column was added
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'workspace_settings' 
AND column_name = 'default_interface_id';

