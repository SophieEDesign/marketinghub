-- Migration: Fix default_interface_id foreign key constraint
-- The constraint currently references views(id), but should reference interface_pages(id)
-- since the system now uses interface_pages as the primary table for pages/interfaces

DO $$
BEGIN
  -- Check if the column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'workspace_settings' 
    AND column_name = 'default_interface_id'
  ) THEN
    -- Drop the old foreign key constraint if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public' 
      AND table_name = 'workspace_settings' 
      AND constraint_name = 'workspace_settings_default_interface_id_fkey'
    ) THEN
      ALTER TABLE public.workspace_settings
        DROP CONSTRAINT workspace_settings_default_interface_id_fkey;
      
      RAISE NOTICE 'Dropped old foreign key constraint';
    END IF;
    
    -- Add new foreign key constraint pointing to interface_pages
    ALTER TABLE public.workspace_settings
      ADD CONSTRAINT workspace_settings_default_interface_id_fkey 
      FOREIGN KEY (default_interface_id) 
      REFERENCES public.interface_pages(id) 
      ON DELETE SET NULL;
    
    RAISE NOTICE 'Added new foreign key constraint to interface_pages';
  ELSE
    RAISE NOTICE 'Column default_interface_id does not exist, skipping migration';
  END IF;
END $$;

-- Verify the constraint was updated
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'workspace_settings'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'default_interface_id';



