-- ============================================================================
-- Verification Script: Check Schema Integrity Fixes
-- ============================================================================
-- Run this after fix_schema_integrity_issues.sql to verify all fixes were applied
-- ============================================================================

-- Check 1: Verify column rename
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'table_briefings_1768073365356'
        AND column_name = 'third_party_spokesperson_quote_if_applicable'
    ) THEN
        RAISE NOTICE '✅ Column rename successful: third_party_spokesperson_quote_if_applicable';
    ELSE
        RAISE WARNING '❌ Column rename may have failed - check manually';
    END IF;
END $$;

-- Check 2: Verify foreign keys were added
DO $$
DECLARE
    fk_count integer;
    expected_fks text[] := ARRAY[
        'table_content_quarterly_theme_fkey',
        'table_events_linked_theme_fkey',
        'table_events_location_fkey',
        'table_events_before_content_fkey',
        'table_events_during_content_fkey',
        'table_events_after_content_fkey',
        'table_events_sponsorship_fkey',
        'table_quarterly_themes_location_spotlight_fkey',
        'table_quarterly_themes_themes_fkey',
        'table_tasks_allocated_to_fkey',
        'table_tasks_content_fkey',
        'table_tasks_theme_fkey',
        'table_tasks_events_fkey',
        'table_tasks_sponsorships_fkey',
        'table_theme_division_matrix_core_theme_fkey'
    ];
    fk_name text;
    found_count integer := 0;
BEGIN
    FOREACH fk_name IN ARRAY expected_fks LOOP
        SELECT COUNT(*) INTO fk_count
        FROM information_schema.table_constraints
        WHERE constraint_name = fk_name
        AND table_schema = 'public';
        
        IF fk_count > 0 THEN
            found_count := found_count + 1;
            RAISE NOTICE '✅ Found FK: %', fk_name;
        ELSE
            RAISE WARNING '❌ Missing FK: %', fk_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Found % of % expected foreign keys', found_count, array_length(expected_fks, 1);
END $$;

-- Check 3: Verify indexes were created
DO $$
DECLARE
    idx_count integer;
    expected_indexes text[] := ARRAY[
        'idx_automation_logs_automation_id',
        'idx_automation_logs_run_id',
        'idx_automation_runs_automation_id',
        'idx_entity_activity_log_entity',
        'idx_favorites_user_entity',
        'idx_recent_items_user_entity',
        'idx_table_rows_table_id',
        'idx_view_blocks_view_id',
        'idx_view_blocks_page_id',
        'idx_table_content_quarterly_theme',
        'idx_table_events_linked_theme',
        'idx_table_events_location',
        'idx_table_tasks_allocated_to'
    ];
    idx_name text;
    found_count integer := 0;
BEGIN
    FOREACH idx_name IN ARRAY expected_indexes LOOP
        SELECT COUNT(*) INTO idx_count
        FROM pg_indexes
        WHERE indexname = idx_name
        AND schemaname = 'public';
        
        IF idx_count > 0 THEN
            found_count := found_count + 1;
            RAISE NOTICE '✅ Found index: %', idx_name;
        ELSE
            RAISE WARNING '❌ Missing index: %', idx_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Found % of % expected indexes', found_count, array_length(expected_indexes, 1);
END $$;

-- Check 4: Verify ARRAY columns were converted to text[]
DO $$
DECLARE
    col_count integer;
    test_columns text[] := ARRAY[
        'table_briefings_1768073365356.key_messages',
        'table_briefings_1768073365356.whats_the_story',
        'table_campaigns_1768074134170.notes',
        'table_content_1768242820540.channels',
        'table_events_1768569094201.event_type'
    ];
    col_info text;
    p_table_name text;
    p_column_name text;
    p_data_type text;
    found_count integer := 0;
BEGIN
    FOREACH col_info IN ARRAY test_columns LOOP
        p_table_name := split_part(col_info, '.', 1);
        p_column_name := split_part(col_info, '.', 2);
        
        SELECT c.data_type INTO p_data_type
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
        AND c.table_name = p_table_name
        AND c.column_name = p_column_name;
        
        IF p_data_type = 'ARRAY' THEN
            RAISE WARNING '❌ Column %.% is still untyped ARRAY', p_table_name, p_column_name;
        ELSIF p_data_type = 'text[]' OR p_data_type LIKE '%text[]%' THEN
            found_count := found_count + 1;
            RAISE NOTICE '✅ Column %.% is now text[]', p_table_name, p_column_name;
        ELSE
            RAISE NOTICE '⚠️  Column %.% has type: % (expected text[])', p_table_name, p_column_name, p_data_type;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Verified % of % test columns', found_count, array_length(test_columns, 1);
END $$;

-- Check 5: Verify NOT NULL constraints
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'interface_pages'
        AND column_name = 'group_id'
        AND is_nullable = 'NO'
    ) THEN
        RAISE NOTICE '✅ interface_pages.group_id has NOT NULL constraint';
    ELSE
        RAISE WARNING '❌ interface_pages.group_id is still nullable';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'workspace_settings'
        AND column_name = 'workspace_id'
        AND is_nullable = 'NO'
    ) THEN
        RAISE NOTICE '✅ workspace_settings.workspace_id has NOT NULL constraint';
    ELSE
        RAISE WARNING '❌ workspace_settings.workspace_id is still nullable';
    END IF;
END $$;

-- Check 6: Verify ON DELETE behaviors
DO $$
DECLARE
    p_delete_rule text;
BEGIN
    SELECT rc.delete_rule INTO p_delete_rule
    FROM information_schema.referential_constraints rc
    WHERE rc.constraint_name = 'automation_logs_automation_id_fkey'
    AND rc.constraint_schema = 'public';
    
    IF p_delete_rule = 'CASCADE' THEN
        RAISE NOTICE '✅ automation_logs_automation_id_fkey has ON DELETE CASCADE';
    ELSE
        RAISE WARNING '❌ automation_logs_automation_id_fkey delete rule: %', p_delete_rule;
    END IF;
    
    SELECT rc.delete_rule INTO p_delete_rule
    FROM information_schema.referential_constraints rc
    WHERE rc.constraint_name = 'views_default_view_fkey'
    AND rc.constraint_schema = 'public';
    
    IF p_delete_rule = 'SET NULL' THEN
        RAISE NOTICE '✅ views_default_view_fkey has ON DELETE SET NULL';
    ELSE
        RAISE WARNING '❌ views_default_view_fkey delete rule: %', p_delete_rule;
    END IF;
END $$;

-- Check 7: Verify circular reference trigger
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'prevent_view_circular_reference'
        AND tgrelid = 'public.views'::regclass
    ) THEN
        RAISE NOTICE '✅ Circular reference prevention trigger exists';
    ELSE
        RAISE WARNING '❌ Circular reference prevention trigger not found';
    END IF;
END $$;

-- Summary report
SELECT 
    'Schema Fix Verification Complete' as status,
    NOW() as verified_at;
