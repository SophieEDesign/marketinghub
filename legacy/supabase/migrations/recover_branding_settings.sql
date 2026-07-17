-- ============================================================================
-- Recovery Script: Restore Branding Settings
-- ============================================================================
-- This script attempts to recover branding settings that may have been lost
-- during the schema migration fix_schema_integrity_issues.sql
-- ============================================================================

BEGIN;

-- Check if workspace_settings table is empty or missing data
DO $$
DECLARE
    settings_count integer;
    workspace_id_type text;
    default_workspace_id text;  -- Changed from uuid to text to handle both types
BEGIN
    -- Count existing settings
    SELECT COUNT(*) INTO settings_count
    FROM public.workspace_settings;
    
    RAISE NOTICE 'Current workspace_settings count: %', settings_count;
    
    -- If no settings exist, try to recover or create default
    IF settings_count = 0 THEN
        RAISE WARNING 'No workspace_settings found! Attempting recovery...';
        
        -- Check workspace_id type
        SELECT data_type INTO workspace_id_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'workspace_settings'
        AND column_name = 'workspace_id';
        
        RAISE NOTICE 'workspace_id type: %', workspace_id_type;
        
        -- Get or create a default workspace
        IF workspace_id_type = 'uuid' THEN
            -- For UUID type, we need a UUID workspace
            -- First, check if workspaces.id is UUID or text
            DECLARE
                workspaces_id_type text;
                workspace_uuid_id uuid;
            BEGIN
                SELECT data_type INTO workspaces_id_type
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'workspaces'
                AND column_name = 'id';
                
                IF workspaces_id_type = 'uuid' THEN
                    -- Get existing UUID workspace
                    SELECT id INTO workspace_uuid_id
                    FROM public.workspaces
                    ORDER BY created_at ASC
                    LIMIT 1;
                    
                    -- If no workspace exists, create one (UUID will be auto-generated)
                    IF workspace_uuid_id IS NULL THEN
                        INSERT INTO public.workspaces (name)
                        VALUES ('Marketing Hub')
                        RETURNING id INTO workspace_uuid_id;
                        
                        RAISE NOTICE 'Created new UUID workspace with id: %', workspace_uuid_id;
                    END IF;
                    
                    default_workspace_id := workspace_uuid_id::text;
                ELSE
                    -- workspaces.id is text, but workspace_settings.workspace_id is UUID
                    -- This is a schema mismatch - we need to fix it first
                    RAISE WARNING 'Schema mismatch detected: workspaces.id is % but workspace_settings.workspace_id is uuid', workspaces_id_type;
                    RAISE WARNING 'Please run migration: fix_workspace_settings_workspace_id_type.sql to fix this';
                    RAISE EXCEPTION 'Schema mismatch: workspaces.id is % but workspace_settings.workspace_id is uuid. Please run fix_workspace_settings_workspace_id_type.sql migration first.', workspaces_id_type;
                END IF;
            END;
            
            -- Create default branding settings
            INSERT INTO public.workspace_settings (
                workspace_id,
                brand_name,
                logo_url,
                primary_color,
                accent_color,
                sidebar_color,
                sidebar_text_color
            ) VALUES (
                default_workspace_id::uuid,
                'Marketing Hub',
                NULL,
                'hsl(222.2, 47.4%, 11.2%)',
                'hsl(210, 40%, 96.1%)',
                '#ffffff',
                '#4b5563'
            )
            ON CONFLICT (workspace_id) DO NOTHING;
            
            RAISE NOTICE 'Created default branding settings with workspace_id: %', default_workspace_id;
            
        ELSIF workspace_id_type = 'text' OR workspace_id_type = 'character varying' THEN
            -- For text type, use 'default'
            INSERT INTO public.workspace_settings (
                workspace_id,
                brand_name,
                logo_url,
                primary_color,
                accent_color,
                sidebar_color,
                sidebar_text_color
            ) VALUES (
                'default',
                'Marketing Hub',
                NULL,
                'hsl(222.2, 47.4%, 11.2%)',
                'hsl(210, 40%, 96.1%)',
                '#ffffff',
                '#4b5563'
            )
            ON CONFLICT (workspace_id) DO NOTHING;
            
            RAISE NOTICE 'Created default branding settings with workspace_id: default';
        END IF;
    ELSE
        RAISE NOTICE 'Workspace settings exist. No recovery needed.';
    END IF;
END $$;

-- Check if we can recover from PostgreSQL WAL or check for backups
-- Note: This requires database-level access and may not be available
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RECOVERY OPTIONS:';
    RAISE NOTICE '========================================';
    RAISE NOTICE '1. Check if you have a database backup from before the migration';
    RAISE NOTICE '2. Check Supabase dashboard for point-in-time recovery';
    RAISE NOTICE '3. If you have the old values, manually insert them:';
    RAISE NOTICE '';
    RAISE NOTICE '   INSERT INTO workspace_settings (workspace_id, brand_name, logo_url, ...)';
    RAISE NOTICE '   VALUES (...);';
    RAISE NOTICE '';
    RAISE NOTICE '4. Check application logs or browser cache for old values';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ============================================================================
-- Manual Recovery Query Template
-- ============================================================================
-- If you remember your branding settings, use this template to restore them:
--
-- INSERT INTO public.workspace_settings (
--     workspace_id,
--     brand_name,
--     logo_url,
--     primary_color,
--     accent_color,
--     sidebar_color,
--     sidebar_text_color
-- ) VALUES (
--     'your-workspace-id-here'::uuid,  -- or 'default' if text type
--     'Your Brand Name',
--     'https://your-logo-url.com/logo.png',
--     'hsl(222.2, 47.4%, 11.2%)',  -- Your primary color
--     'hsl(210, 40%, 96.1%)',      -- Your accent color
--     '#ffffff',                   -- Your sidebar color
--     '#4b5563'                    -- Your sidebar text color
-- )
-- ON CONFLICT (workspace_id) DO UPDATE SET
--     brand_name = EXCLUDED.brand_name,
--     logo_url = EXCLUDED.logo_url,
--     primary_color = EXCLUDED.primary_color,
--     accent_color = EXCLUDED.accent_color,
--     sidebar_color = EXCLUDED.sidebar_color,
--     sidebar_text_color = EXCLUDED.sidebar_text_color,
--     updated_at = NOW();
-- ============================================================================
