-- ============================================================================
-- Migration: Fix workspace_settings.workspace_id Type Mismatch
-- ============================================================================
-- Issue: workspaces.id is text but workspace_settings.workspace_id is uuid
-- Solution: Change workspace_settings.workspace_id to text to match workspaces.id
-- ============================================================================

BEGIN;

-- Check current types
DO $$
DECLARE
    workspaces_id_type text;
    workspace_settings_id_type text;
BEGIN
    SELECT data_type INTO workspaces_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'workspaces'
    AND column_name = 'id';
    
    SELECT data_type INTO workspace_settings_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'workspace_settings'
    AND column_name = 'workspace_id';
    
    RAISE NOTICE 'Current types: workspaces.id = %, workspace_settings.workspace_id = %', 
        workspaces_id_type, workspace_settings_id_type;
    
    -- If there's a mismatch and workspace_settings.workspace_id is uuid
    IF workspace_settings_id_type = 'uuid' AND workspaces_id_type = 'text' THEN
        RAISE NOTICE 'Fixing type mismatch: converting workspace_settings.workspace_id from uuid to text';
        
        -- First, drop any foreign key constraint if it exists
        ALTER TABLE public.workspace_settings
        DROP CONSTRAINT IF EXISTS workspace_settings_workspace_id_fkey;
        
        -- Drop the UNIQUE constraint temporarily (we'll recreate it)
        ALTER TABLE public.workspace_settings
        DROP CONSTRAINT IF EXISTS workspace_settings_workspace_id_key;
        
        -- Convert uuid to text first (this will convert existing UUIDs to text strings)
        -- NULL values will remain NULL after conversion
        ALTER TABLE public.workspace_settings
        ALTER COLUMN workspace_id TYPE text USING 
            CASE 
                WHEN workspace_id IS NULL THEN NULL
                ELSE workspace_id::text
            END;
        
        -- Now set NULL values to 'default' (after type conversion)
        UPDATE public.workspace_settings
        SET workspace_id = 'default'
        WHERE workspace_id IS NULL;
        
        -- Ensure 'default' workspace exists
        INSERT INTO public.workspaces (id, name)
        VALUES ('default', 'Marketing Hub')
        ON CONFLICT (id) DO NOTHING;
        
        -- Recreate UNIQUE constraint
        ALTER TABLE public.workspace_settings
        ADD CONSTRAINT workspace_settings_workspace_id_key UNIQUE (workspace_id);
        
        -- Recreate foreign key constraint to workspaces
        ALTER TABLE public.workspace_settings
        ADD CONSTRAINT workspace_settings_workspace_id_fkey
        FOREIGN KEY (workspace_id) 
        REFERENCES public.workspaces(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Successfully converted workspace_settings.workspace_id to text';
    ELSIF workspace_settings_id_type = 'text' AND workspaces_id_type = 'text' THEN
        RAISE NOTICE 'Types already match (both text) - no change needed';
    ELSE
        RAISE NOTICE 'Types are compatible or different mismatch - no action taken';
    END IF;
END $$;

-- Verify the fix
DO $$
DECLARE
    workspace_settings_id_type text;
BEGIN
    SELECT data_type INTO workspace_settings_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'workspace_settings'
    AND column_name = 'workspace_id';
    
    IF workspace_settings_id_type = 'text' THEN
        RAISE NOTICE '✅ Verification: workspace_settings.workspace_id is now text';
    ELSE
        RAISE WARNING '⚠️ Verification: workspace_settings.workspace_id type is %', workspace_settings_id_type;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- workspace_settings.workspace_id is now text to match workspaces.id
-- Foreign key constraint has been recreated
-- ============================================================================
