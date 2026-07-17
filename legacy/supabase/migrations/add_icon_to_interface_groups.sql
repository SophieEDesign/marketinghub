-- Migration: Add icon column to interface_groups table
-- This allows interfaces to have simple icons (Lucide icon names) instead of emojis

-- Add icon column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'interface_groups' 
    AND column_name = 'icon'
  ) THEN
    ALTER TABLE public.interface_groups
      ADD COLUMN icon text;
    
    COMMENT ON COLUMN public.interface_groups.icon IS 'Lucide icon name for the interface (e.g., Calendar, Folder, etc.)';
  END IF;
END $$;
