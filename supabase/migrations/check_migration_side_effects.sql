-- ============================================================================
-- Check for Side Effects from fix_schema_integrity_issues.sql Migration
-- ============================================================================
-- This script checks for potential issues that might have been introduced
-- ============================================================================

-- Check 1: Verify interface_pages.group_id NOT NULL doesn't break page creation
DO $$
DECLARE
    system_group_count integer;
    null_group_pages integer;
BEGIN
    -- Check if system groups exist
    SELECT COUNT(*) INTO system_group_count
    FROM public.interface_groups
    WHERE is_system = true;
    
    -- Check for pages without group_id (should be 0 after migration)
    SELECT COUNT(*) INTO null_group_pages
    FROM public.interface_pages
    WHERE group_id IS NULL;
    
    IF system_group_count = 0 THEN
        RAISE WARNING '⚠️ No system groups found! Page creation may fail if group_id is not provided.';
        RAISE WARNING '   Run ensure_ungrouped_group.sql migration to create default group.';
    ELSE
        RAISE NOTICE '✅ Found % system group(s) - page creation should work', system_group_count;
    END IF;
    
    IF null_group_pages > 0 THEN
        RAISE WARNING '⚠️ Found % interface_pages with NULL group_id - these may cause issues', null_group_pages;
    ELSE
        RAISE NOTICE '✅ All interface_pages have group_id set';
    END IF;
END $$;

-- Check 2: Verify ARRAY columns were converted correctly
DO $$
DECLARE
    array_columns integer;
    text_array_columns integer;
BEGIN
    -- Count columns that are still untyped ARRAY
    SELECT COUNT(*) INTO array_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND data_type = 'ARRAY'
    AND table_name LIKE 'table_%';
    
    -- Count columns that are text[]
    SELECT COUNT(*) INTO text_array_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND (data_type = 'ARRAY' AND udt_name = '_text')
    AND table_name LIKE 'table_%';
    
    IF array_columns > 0 THEN
        RAISE WARNING '⚠️ Found % columns still using untyped ARRAY - may cause query issues', array_columns;
    ELSE
        RAISE NOTICE '✅ No untyped ARRAY columns found';
    END IF;
    
    RAISE NOTICE 'Found % text[] columns', text_array_columns;
END $$;

-- Check 3: Check for orphaned records from ON DELETE CASCADE
DO $$
DECLARE
    orphaned_logs integer;
    orphaned_runs integer;
    orphaned_blocks integer;
BEGIN
    -- Check automation_logs without valid automation
    SELECT COUNT(*) INTO orphaned_logs
    FROM public.automation_logs al
    WHERE NOT EXISTS (
        SELECT 1 FROM public.automations a WHERE a.id = al.automation_id
    );
    
    -- Check automation_runs without valid automation
    SELECT COUNT(*) INTO orphaned_runs
    FROM public.automation_runs ar
    WHERE NOT EXISTS (
        SELECT 1 FROM public.automations a WHERE a.id = ar.automation_id
    );
    
    -- Check view_blocks without valid view
    SELECT COUNT(*) INTO orphaned_blocks
    FROM public.view_blocks vb
    WHERE vb.view_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.views v WHERE v.id = vb.view_id
    );
    
    IF orphaned_logs > 0 THEN
        RAISE WARNING '⚠️ Found % orphaned automation_logs (automation deleted)', orphaned_logs;
    ELSE
        RAISE NOTICE '✅ No orphaned automation_logs';
    END IF;
    
    IF orphaned_runs > 0 THEN
        RAISE WARNING '⚠️ Found % orphaned automation_runs (automation deleted)', orphaned_runs;
    ELSE
        RAISE NOTICE '✅ No orphaned automation_runs';
    END IF;
    
    IF orphaned_blocks > 0 THEN
        RAISE WARNING '⚠️ Found % orphaned view_blocks (view deleted)', orphaned_blocks;
    ELSE
        RAISE NOTICE '✅ No orphaned view_blocks';
    END IF;
END $$;

-- Check 4: Verify foreign keys are working
DO $$
DECLARE
    fk_count integer;
    broken_fks integer := 0;
BEGIN
    -- Check for foreign key constraints that might be broken
    SELECT COUNT(*) INTO fk_count
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
    AND table_schema = 'public'
    AND table_name LIKE 'table_%';
    
    RAISE NOTICE 'Found % foreign key constraints on dynamic tables', fk_count;
    
    -- This is just informational - actual FK violations would show up in queries
END $$;

-- Check 5: Verify NOT NULL constraints don't break inserts
DO $$
DECLARE
    workspace_settings_nullable boolean;
    interface_pages_group_nullable boolean;
BEGIN
    SELECT is_nullable = 'YES' INTO workspace_settings_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'workspace_settings'
    AND column_name = 'workspace_id';
    
    SELECT is_nullable = 'YES' INTO interface_pages_group_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'interface_pages'
    AND column_name = 'group_id';
    
    IF workspace_settings_nullable THEN
        RAISE WARNING '⚠️ workspace_settings.workspace_id is still nullable - NOT NULL constraint may not have been applied';
    ELSE
        RAISE NOTICE '✅ workspace_settings.workspace_id has NOT NULL constraint';
    END IF;
    
    IF interface_pages_group_nullable THEN
        RAISE WARNING '⚠️ interface_pages.group_id is still nullable - NOT NULL constraint may not have been applied';
    ELSE
        RAISE NOTICE '✅ interface_pages.group_id has NOT NULL constraint';
    END IF;
END $$;

-- Summary
SELECT 
    'Migration Side Effects Check Complete' as status,
    NOW() as checked_at;
