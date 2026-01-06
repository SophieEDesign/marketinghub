-- Migration: Add is_admin_only field to interface_groups table
-- This allows interfaces (not just pages) to be marked as admin-only

-- Add is_admin_only column to interface_groups if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'interface_groups' 
    AND column_name = 'is_admin_only'
  ) THEN
    ALTER TABLE public.interface_groups
      ADD COLUMN is_admin_only boolean NOT NULL DEFAULT false;
    
    -- Add comment
    COMMENT ON COLUMN public.interface_groups.is_admin_only IS 'If true, only admins can see and access this interface. If false, all authenticated users can access it.';
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_interface_groups_is_admin_only 
  ON public.interface_groups(is_admin_only);


