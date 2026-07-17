-- ============================================================================
-- Migration: Fix Schema Integrity Issues
-- ============================================================================
-- This migration addresses issues identified in the schema quick check:
-- 1. Add missing foreign key constraints
-- 2. Rename invalid column names (starting with numbers)
-- 3. Add missing indexes for foreign keys
-- 4. Add ON DELETE behaviors to foreign keys
-- 5. Fix untyped ARRAY columns (convert to text[] or jsonb)
-- 6. Add NOT NULL constraints where appropriate
-- ============================================================================
-- Date: 2026-01-25
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Rename Invalid Column Names
-- ============================================================================
-- Fix column names that start with numbers (invalid in SQL)

DO $$
BEGIN
    -- Check if the column exists before renaming
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'table_briefings_1768073365356'
        AND column_name = '3rd_party_spokesperson_quote_if_applicable'
    ) THEN
        ALTER TABLE public.table_briefings_1768073365356
        RENAME COLUMN "3rd_party_spokesperson_quote_if_applicable" 
        TO third_party_spokesperson_quote_if_applicable;
        
        RAISE NOTICE 'Renamed column 3rd_party_spokesperson_quote_if_applicable to third_party_spokesperson_quote_if_applicable';
    END IF;
END $$;

-- ============================================================================
-- SECTION 2: Add Missing Foreign Key Constraints
-- ============================================================================
-- Add foreign keys for data integrity in dynamic content tables

-- table_content_1768242820540 foreign keys
DO $$
BEGIN
    -- quarterly_theme -> table_quarterly_themes_1768568434852
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_content_quarterly_theme_fkey'
        AND table_schema = 'public'
        AND table_name = 'table_content_1768242820540'
    ) THEN
        -- Clean up orphaned records
        UPDATE public.table_content_1768242820540
        SET quarterly_theme = NULL
        WHERE quarterly_theme IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.table_quarterly_themes_1768568434852 t 
            WHERE t.id = table_content_1768242820540.quarterly_theme
        );
        
        ALTER TABLE public.table_content_1768242820540
        ADD CONSTRAINT table_content_quarterly_theme_fkey
        FOREIGN KEY (quarterly_theme) 
        REFERENCES public.table_quarterly_themes_1768568434852(id)
        ON DELETE SET NULL;
        
        RAISE NOTICE 'Added FK: table_content_1768242820540.quarterly_theme';
    END IF;
    
    -- post_originator_approve -> auth.users (if this is a user reference)
    -- Note: This might reference a different table - adjust if needed
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_content_post_originator_approve_fkey'
        AND table_schema = 'public'
        AND table_name = 'table_content_1768242820540'
    ) THEN
        -- Check if column exists and has data before adding FK
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'table_content_1768242820540'
            AND column_name = 'post_originator_approve'
        ) THEN
            -- Only add if all values are valid UUIDs that exist in auth.users
            -- For now, we'll skip this if there are invalid references
            -- Uncomment and adjust if you confirm this should reference auth.users
            /*
            ALTER TABLE public.table_content_1768242820540
            ADD CONSTRAINT table_content_post_originator_approve_fkey
            FOREIGN KEY (post_originator_approve) 
            REFERENCES auth.users(id)
            ON DELETE SET NULL;
            */
            RAISE NOTICE 'Skipped FK for post_originator_approve - verify target table first';
        END IF;
    END IF;
END $$;

-- table_events_1768569094201 foreign keys
DO $$
BEGIN
    -- linked_theme -> table_quarterly_themes_1768568434852
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_events_linked_theme_fkey'
        AND table_schema = 'public'
        AND table_name = 'table_events_1768569094201'
    ) THEN
        -- Clean up orphaned records
        UPDATE public.table_events_1768569094201
        SET linked_theme = NULL
        WHERE linked_theme IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.table_quarterly_themes_1768568434852 t 
            WHERE t.id = table_events_1768569094201.linked_theme
        );
        
        ALTER TABLE public.table_events_1768569094201
        ADD CONSTRAINT table_events_linked_theme_fkey
        FOREIGN KEY (linked_theme) 
        REFERENCES public.table_quarterly_themes_1768568434852(id)
        ON DELETE SET NULL;
    END IF;
    
    -- location -> table_locations_1768568830022
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_events_location_fkey'
        AND table_schema = 'public'
        AND table_name = 'table_events_1768569094201'
    ) THEN
        -- Clean up orphaned records
        UPDATE public.table_events_1768569094201
        SET location = NULL
        WHERE location IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.table_locations_1768568830022 l 
            WHERE l.id = table_events_1768569094201.location
        );
        
        ALTER TABLE public.table_events_1768569094201
        ADD CONSTRAINT table_events_location_fkey
        FOREIGN KEY (location) 
        REFERENCES public.table_locations_1768568830022(id)
        ON DELETE SET NULL;
    END IF;
    
    -- before_content -> table_content_1768242820540
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_events_before_content_fkey'
        AND table_schema = 'public'
        AND table_name = 'table_events_1768569094201'
    ) THEN
        -- Clean up orphaned records
        UPDATE public.table_events_1768569094201
        SET before_content = NULL
        WHERE before_content IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.table_content_1768242820540 c 
            WHERE c.id = table_events_1768569094201.before_content
        );
        
        ALTER TABLE public.table_events_1768569094201
        ADD CONSTRAINT table_events_before_content_fkey
        FOREIGN KEY (before_content) 
        REFERENCES public.table_content_1768242820540(id)
        ON DELETE SET NULL;
    END IF;
    
    -- during_content -> table_content_1768242820540
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_events_during_content_fkey'
        AND table_schema = 'public'
        AND table_name = 'table_events_1768569094201'
    ) THEN
        -- Clean up orphaned records
        UPDATE public.table_events_1768569094201
        SET during_content = NULL
        WHERE during_content IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.table_content_1768242820540 c 
            WHERE c.id = table_events_1768569094201.during_content
        );
        
        ALTER TABLE public.table_events_1768569094201
        ADD CONSTRAINT table_events_during_content_fkey
        FOREIGN KEY (during_content) 
        REFERENCES public.table_content_1768242820540(id)
        ON DELETE SET NULL;
    END IF;
    
    -- after_content -> table_content_1768242820540
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_events_after_content_fkey'
        AND table_schema = 'public'
        AND table_name = 'table_events_1768569094201'
    ) THEN
        -- Clean up orphaned records
        UPDATE public.table_events_1768569094201
        SET after_content = NULL
        WHERE after_content IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.table_content_1768242820540 c 
            WHERE c.id = table_events_1768569094201.after_content
        );
        
        ALTER TABLE public.table_events_1768569094201
        ADD CONSTRAINT table_events_after_content_fkey
        FOREIGN KEY (after_content) 
        REFERENCES public.table_content_1768242820540(id)
        ON DELETE SET NULL;
    END IF;
    
    -- sponsorship -> table_sponsorships_1768074191424
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_events_sponsorship_fkey'
        AND table_schema = 'public'
        AND table_name = 'table_events_1768569094201'
    ) THEN
        -- Clean up orphaned records
        UPDATE public.table_events_1768569094201
        SET sponsorship = NULL
        WHERE sponsorship IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.table_sponsorships_1768074191424 s 
            WHERE s.id = table_events_1768569094201.sponsorship
        );
        
        ALTER TABLE public.table_events_1768569094201
        ADD CONSTRAINT table_events_sponsorship_fkey
        FOREIGN KEY (sponsorship) 
        REFERENCES public.table_sponsorships_1768074191424(id)
        ON DELETE SET NULL;
    END IF;
    
    RAISE NOTICE 'Added FKs for table_events_1768569094201';
END $$;

-- table_locations_1768568830022 foreign keys
DO $$
BEGIN
    -- preferred_spokespeople -> table_contact_1768073851531 (if this is the target)
    -- Note: This might be a multi-reference field - verify target table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_locations_preferred_spokespeople_fkey'
        AND table_schema = 'public'
        AND table_name = 'table_locations_1768568830022'
    ) THEN
        -- Skipping for now - verify if this should reference contacts or another table
        RAISE NOTICE 'Skipped FK for preferred_spokespeople - verify target table first';
    END IF;
END $$;

-- table_quarterly_themes_1768568434852 foreign keys
DO $$
BEGIN
    -- location_spotlight -> table_locations_1768568830022
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_quarterly_themes_location_spotlight_fkey'
        AND table_schema = 'public'
        AND table_name = 'table_quarterly_themes_1768568434852'
    ) THEN
        -- Clean up orphaned records
        UPDATE public.table_quarterly_themes_1768568434852
        SET location_spotlight = NULL
        WHERE location_spotlight IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.table_locations_1768568830022 l 
            WHERE l.id = table_quarterly_themes_1768568434852.location_spotlight
        );
        
        ALTER TABLE public.table_quarterly_themes_1768568434852
        ADD CONSTRAINT table_quarterly_themes_location_spotlight_fkey
        FOREIGN KEY (location_spotlight) 
        REFERENCES public.table_locations_1768568830022(id)
        ON DELETE SET NULL;
    END IF;
    
    -- themes -> self-reference (if this is a parent theme relationship)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_quarterly_themes_themes_fkey'
        AND table_schema = 'public'
        AND table_name = 'table_quarterly_themes_1768568434852'
    ) THEN
        -- Clean up orphaned records (self-reference)
        UPDATE public.table_quarterly_themes_1768568434852
        SET themes = NULL
        WHERE themes IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.table_quarterly_themes_1768568434852 t 
            WHERE t.id = table_quarterly_themes_1768568434852.themes
        );
        
        ALTER TABLE public.table_quarterly_themes_1768568434852
        ADD CONSTRAINT table_quarterly_themes_themes_fkey
        FOREIGN KEY (themes) 
        REFERENCES public.table_quarterly_themes_1768568434852(id)
        ON DELETE SET NULL;
    END IF;
    
    RAISE NOTICE 'Added FKs for table_quarterly_themes_1768568434852';
END $$;

-- table_tasks_1768655456178 foreign keys
DO $$
BEGIN
    -- allocated_to -> auth.users
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_tasks_allocated_to_fkey'
        AND table_schema = 'public'
        AND table_name = 'table_tasks_1768655456178'
    ) THEN
        -- First, clean up orphaned records (set to NULL)
        UPDATE public.table_tasks_1768655456178
        SET allocated_to = NULL
        WHERE allocated_to IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM auth.users u 
            WHERE u.id = table_tasks_1768655456178.allocated_to
        );
        
        -- Now add the foreign key constraint
        ALTER TABLE public.table_tasks_1768655456178
        ADD CONSTRAINT table_tasks_allocated_to_fkey
        FOREIGN KEY (allocated_to) 
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
        
        RAISE NOTICE 'Cleaned orphaned allocated_to references and added FK';
    END IF;
    
    -- content -> table_content_1768242820540
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_tasks_content_fkey'
        AND table_schema = 'public'
        AND table_name = 'table_tasks_1768655456178'
    ) THEN
        -- Clean up orphaned records
        UPDATE public.table_tasks_1768655456178
        SET content = NULL
        WHERE content IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.table_content_1768242820540 c 
            WHERE c.id = table_tasks_1768655456178.content
        );
        
        ALTER TABLE public.table_tasks_1768655456178
        ADD CONSTRAINT table_tasks_content_fkey
        FOREIGN KEY (content) 
        REFERENCES public.table_content_1768242820540(id)
        ON DELETE SET NULL;
    END IF;
    
    -- theme -> table_quarterly_themes_1768568434852
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_tasks_theme_fkey'
        AND table_schema = 'public'
        AND table_name = 'table_tasks_1768655456178'
    ) THEN
        -- Clean up orphaned records
        UPDATE public.table_tasks_1768655456178
        SET theme = NULL
        WHERE theme IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.table_quarterly_themes_1768568434852 t 
            WHERE t.id = table_tasks_1768655456178.theme
        );
        
        ALTER TABLE public.table_tasks_1768655456178
        ADD CONSTRAINT table_tasks_theme_fkey
        FOREIGN KEY (theme) 
        REFERENCES public.table_quarterly_themes_1768568434852(id)
        ON DELETE SET NULL;
    END IF;
    
    -- events -> table_events_1768569094201
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_tasks_events_fkey'
        AND table_schema = 'public'
        AND table_name = 'table_tasks_1768655456178'
    ) THEN
        -- Clean up orphaned records
        UPDATE public.table_tasks_1768655456178
        SET events = NULL
        WHERE events IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.table_events_1768569094201 e 
            WHERE e.id = table_tasks_1768655456178.events
        );
        
        ALTER TABLE public.table_tasks_1768655456178
        ADD CONSTRAINT table_tasks_events_fkey
        FOREIGN KEY (events) 
        REFERENCES public.table_events_1768569094201(id)
        ON DELETE SET NULL;
    END IF;
    
    -- sponsorships -> table_sponsorships_1768074191424
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_tasks_sponsorships_fkey'
        AND table_schema = 'public'
        AND table_name = 'table_tasks_1768655456178'
    ) THEN
        -- Clean up orphaned records
        UPDATE public.table_tasks_1768655456178
        SET sponsorships = NULL
        WHERE sponsorships IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.table_sponsorships_1768074191424 s 
            WHERE s.id = table_tasks_1768655456178.sponsorships
        );
        
        ALTER TABLE public.table_tasks_1768655456178
        ADD CONSTRAINT table_tasks_sponsorships_fkey
        FOREIGN KEY (sponsorships) 
        REFERENCES public.table_sponsorships_1768074191424(id)
        ON DELETE SET NULL;
    END IF;
    
    RAISE NOTICE 'Added FKs for table_tasks_1768655456178';
END $$;

-- table_theme_division_matrix_1768568646216 foreign keys
DO $$
BEGIN
    -- core_theme -> table_quarterly_themes_1768568434852
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_theme_division_matrix_core_theme_fkey'
        AND table_schema = 'public'
        AND table_name = 'table_theme_division_matrix_1768568646216'
    ) THEN
        -- Clean up orphaned records
        UPDATE public.table_theme_division_matrix_1768568646216
        SET core_theme = NULL
        WHERE core_theme IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.table_quarterly_themes_1768568434852 t 
            WHERE t.id = table_theme_division_matrix_1768568646216.core_theme
        );
        
        ALTER TABLE public.table_theme_division_matrix_1768568646216
        ADD CONSTRAINT table_theme_division_matrix_core_theme_fkey
        FOREIGN KEY (core_theme) 
        REFERENCES public.table_quarterly_themes_1768568434852(id)
        ON DELETE CASCADE;
    END IF;
    
    RAISE NOTICE 'Added FK for table_theme_division_matrix_1768568646216';
END $$;

-- ============================================================================
-- SECTION 3: Add Missing Indexes for Foreign Keys
-- ============================================================================
-- Add indexes for frequently queried foreign keys to improve performance

-- Automation tables
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id 
    ON public.automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_run_id 
    ON public.automation_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_id 
    ON public.automation_runs(automation_id);

-- Entity activity log
CREATE INDEX IF NOT EXISTS idx_entity_activity_log_entity 
    ON public.entity_activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_activity_log_user_id 
    ON public.entity_activity_log(user_id);

-- Favorites and recent items
CREATE INDEX IF NOT EXISTS idx_favorites_user_entity 
    ON public.favorites(user_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_recent_items_user_entity 
    ON public.recent_items(user_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_recent_items_last_opened 
    ON public.recent_items(user_id, last_opened_at DESC);

-- Table rows
CREATE INDEX IF NOT EXISTS idx_table_rows_table_id 
    ON public.table_rows(table_id);
CREATE INDEX IF NOT EXISTS idx_table_rows_created_at 
    ON public.table_rows(table_id, created_at DESC);

-- View blocks
CREATE INDEX IF NOT EXISTS idx_view_blocks_view_id 
    ON public.view_blocks(view_id);
CREATE INDEX IF NOT EXISTS idx_view_blocks_page_id 
    ON public.view_blocks(page_id);

-- View filters and sorts
CREATE INDEX IF NOT EXISTS idx_view_filters_view_id 
    ON public.view_filters(view_id);
CREATE INDEX IF NOT EXISTS idx_view_filters_filter_group_id 
    ON public.view_filters(filter_group_id);
CREATE INDEX IF NOT EXISTS idx_view_sorts_view_id 
    ON public.view_sorts(view_id);

-- Interface pages
CREATE INDEX IF NOT EXISTS idx_interface_pages_group_id 
    ON public.interface_pages(group_id);
CREATE INDEX IF NOT EXISTS idx_interface_pages_saved_view_id 
    ON public.interface_pages(saved_view_id);

-- Dynamic content table foreign keys (newly added)
CREATE INDEX IF NOT EXISTS idx_table_content_quarterly_theme 
    ON public.table_content_1768242820540(quarterly_theme) 
    WHERE quarterly_theme IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_table_events_linked_theme 
    ON public.table_events_1768569094201(linked_theme) 
    WHERE linked_theme IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_table_events_location 
    ON public.table_events_1768569094201(location) 
    WHERE location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_table_events_sponsorship 
    ON public.table_events_1768569094201(sponsorship) 
    WHERE sponsorship IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_table_tasks_allocated_to 
    ON public.table_tasks_1768655456178(allocated_to) 
    WHERE allocated_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_table_tasks_content 
    ON public.table_tasks_1768655456178(content) 
    WHERE content IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_table_tasks_theme 
    ON public.table_tasks_1768655456178(theme) 
    WHERE theme IS NOT NULL;

-- ============================================================================
-- SECTION 4: Add ON DELETE Behaviors to Existing Foreign Keys
-- ============================================================================
-- Update existing foreign keys to have appropriate ON DELETE behaviors
-- Note: This requires dropping and recreating constraints, so be careful

-- Automation logs - should cascade when automation is deleted
DO $$
BEGIN
    -- Check current constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'automation_logs_automation_id_fkey'
        AND table_schema = 'public'
    ) THEN
        -- Drop and recreate with CASCADE
        ALTER TABLE public.automation_logs
        DROP CONSTRAINT IF EXISTS automation_logs_automation_id_fkey;
        
        ALTER TABLE public.automation_logs
        ADD CONSTRAINT automation_logs_automation_id_fkey
        FOREIGN KEY (automation_id) 
        REFERENCES public.automations(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Updated automation_logs_automation_id_fkey with CASCADE';
    END IF;
END $$;

-- Automation runs - should cascade when automation is deleted
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'automation_runs_automation_id_fkey'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.automation_runs
        DROP CONSTRAINT IF EXISTS automation_runs_automation_id_fkey;
        
        ALTER TABLE public.automation_runs
        ADD CONSTRAINT automation_runs_automation_id_fkey
        FOREIGN KEY (automation_id) 
        REFERENCES public.automations(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Updated automation_runs_automation_id_fkey with CASCADE';
    END IF;
END $$;

-- View blocks - should cascade when view is deleted
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'view_blocks_view_id_fkey'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.view_blocks
        DROP CONSTRAINT IF EXISTS view_blocks_view_id_fkey;
        
        ALTER TABLE public.view_blocks
        ADD CONSTRAINT view_blocks_view_id_fkey
        FOREIGN KEY (view_id) 
        REFERENCES public.views(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Updated view_blocks_view_id_fkey with CASCADE';
    END IF;
END $$;

-- View fields - should cascade when view is deleted
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'view_fields_view_id_fkey'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.view_fields
        DROP CONSTRAINT IF EXISTS view_fields_view_id_fkey;
        
        ALTER TABLE public.view_fields
        ADD CONSTRAINT view_fields_view_id_fkey
        FOREIGN KEY (view_id) 
        REFERENCES public.views(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Updated view_fields_view_id_fkey with CASCADE';
    END IF;
END $$;

-- View filters - should cascade when view is deleted
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'view_filters_view_id_fkey'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.view_filters
        DROP CONSTRAINT IF EXISTS view_filters_view_id_fkey;
        
        ALTER TABLE public.view_filters
        ADD CONSTRAINT view_filters_view_id_fkey
        FOREIGN KEY (view_id) 
        REFERENCES public.views(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Updated view_filters_view_id_fkey with CASCADE';
    END IF;
END $$;

-- View sorts - should cascade when view is deleted
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'view_sorts_view_id_fkey'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.view_sorts
        DROP CONSTRAINT IF EXISTS view_sorts_view_id_fkey;
        
        ALTER TABLE public.view_sorts
        ADD CONSTRAINT view_sorts_view_id_fkey
        FOREIGN KEY (view_id) 
        REFERENCES public.views(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Updated view_sorts_view_id_fkey with CASCADE';
    END IF;
END $$;

-- Views default_view - should set NULL when referenced view is deleted
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'views_default_view_fkey'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.views
        DROP CONSTRAINT IF EXISTS views_default_view_fkey;
        
        ALTER TABLE public.views
        ADD CONSTRAINT views_default_view_fkey
        FOREIGN KEY (default_view) 
        REFERENCES public.views(id)
        ON DELETE SET NULL;
        
        RAISE NOTICE 'Updated views_default_view_fkey with SET NULL';
    END IF;
END $$;

-- ============================================================================
-- SECTION 5: Fix Untyped ARRAY Columns
-- ============================================================================
-- Convert untyped ARRAY columns to text[] for consistency
-- Note: This is a data type change - test carefully in development first

-- Function to safely convert ARRAY to text[]
CREATE OR REPLACE FUNCTION convert_array_to_text_array(
    p_table_name text,
    p_column_name text
) RETURNS void AS $$
DECLARE
    sql_text text;
BEGIN
    -- Check if column exists and is currently untyped ARRAY
    IF EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' 
        AND c.table_name = p_table_name
        AND c.column_name = p_column_name
        AND c.data_type = 'ARRAY'
    ) THEN
        sql_text := format(
            'ALTER TABLE public.%I ALTER COLUMN %I TYPE text[] USING %I::text[]',
            p_table_name,
            p_column_name,
            p_column_name
        );
        EXECUTE sql_text;
        RAISE NOTICE 'Converted %.% from ARRAY to text[]', p_table_name, p_column_name;
    ELSE
        RAISE NOTICE 'Skipped %.% - column does not exist or is not untyped ARRAY', p_table_name, p_column_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Convert ARRAY columns to text[] for all identified tables
-- Briefings
SELECT convert_array_to_text_array('table_briefings_1768073365356', 'key_messages');
SELECT convert_array_to_text_array('table_briefings_1768073365356', 'whats_the_story');
SELECT convert_array_to_text_array('table_briefings_1768073365356', 'approval_process');
SELECT convert_array_to_text_array('table_briefings_1768073365356', 'notes');

-- Campaigns
SELECT convert_array_to_text_array('table_campaigns_1768074134170', 'notes');
SELECT convert_array_to_text_array('table_campaigns_1768074134170', 'content');
SELECT convert_array_to_text_array('table_campaigns_1768074134170', 'content_calendar_from_sponsorships');

-- Contacts
SELECT convert_array_to_text_array('table_contact_1768073851531', 'social_media_posts');
SELECT convert_array_to_text_array('table_contact_1768073851531', 'pr_tracker');

-- Content
SELECT convert_array_to_text_array('table_content_1768242820540', 'channels');

-- Events
SELECT convert_array_to_text_array('table_events_1768569094201', 'event_type');

-- Locations
SELECT convert_array_to_text_array('table_locations_1768568830022', 'key_strengths');

-- Quarterly Themes
SELECT convert_array_to_text_array('table_quarterly_themes_1768568434852', 'lead_divisions');

-- Sponsorships
SELECT convert_array_to_text_array('table_sponsorships_1768074191424', 'marketing_resources');
SELECT convert_array_to_text_array('table_sponsorships_1768074191424', 'documents');
SELECT convert_array_to_text_array('table_sponsorships_1768074191424', 'content_calendar');

-- Tasks
SELECT convert_array_to_text_array('table_tasks_1768655456178', 'divisions');

-- Theme Division Matrix
SELECT convert_array_to_text_array('table_theme_division_matrix_1768568646216', 'typical_content_types');

-- Clean up helper function
DROP FUNCTION IF EXISTS convert_array_to_text_array(text, text);

-- ============================================================================
-- SECTION 6: Add NOT NULL Constraints
-- ============================================================================
-- Add NOT NULL constraints where logically required

-- interface_pages.group_id - already has CHECK, but add NOT NULL for clarity
DO $$
DECLARE
    default_group_id uuid;
    null_count integer;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'interface_pages'
        AND column_name = 'group_id'
        AND is_nullable = 'YES'
    ) THEN
        -- First, ensure a default group exists
        -- Try to get existing system group
        SELECT id INTO default_group_id
        FROM public.interface_groups
        WHERE is_system = true
        ORDER BY created_at ASC
        LIMIT 1;
        
        -- If no system group exists, try to get "Ungrouped" group
        IF default_group_id IS NULL THEN
            SELECT id INTO default_group_id
            FROM public.interface_groups
            WHERE name = 'Ungrouped'
            LIMIT 1;
        END IF;
        
        -- If still no group, create one
        IF default_group_id IS NULL THEN
            INSERT INTO public.interface_groups (name, order_index, collapsed, is_system)
            VALUES ('Ungrouped', 9999, false, true)
            RETURNING id INTO default_group_id;
            
            RAISE NOTICE 'Created default "Ungrouped" group with id: %', default_group_id;
        END IF;
        
        -- Count NULL values
        SELECT COUNT(*) INTO null_count
        FROM public.interface_pages
        WHERE group_id IS NULL;
        
        -- Set NULL values to default group
        IF null_count > 0 AND default_group_id IS NOT NULL THEN
            UPDATE public.interface_pages 
            SET group_id = default_group_id
            WHERE group_id IS NULL;
            
            RAISE NOTICE 'Updated % NULL group_id values to default group', null_count;
        END IF;
        
        -- Now add NOT NULL constraint
        ALTER TABLE public.interface_pages
        ALTER COLUMN group_id SET NOT NULL;
        
        RAISE NOTICE 'Added NOT NULL constraint to interface_pages.group_id';
    END IF;
END $$;

-- workspace_settings.workspace_id - should be NOT NULL
DO $$
DECLARE
    null_count integer;
    col_data_type text;
    default_workspace_id text;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'workspace_settings'
        AND column_name = 'workspace_id'
        AND is_nullable = 'YES'
    ) THEN
        -- Get the data type of workspace_id
        SELECT data_type INTO col_data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'workspace_settings'
        AND column_name = 'workspace_id';
        
        -- Check for NULL values
        SELECT COUNT(*) INTO null_count
        FROM public.workspace_settings
        WHERE workspace_id IS NULL;
        
        IF null_count > 0 THEN
            -- Handle NULL values based on data type
            IF col_data_type = 'text' OR col_data_type = 'character varying' THEN
                -- For text type, use 'default' workspace
                SELECT id INTO default_workspace_id
                FROM public.workspaces
                WHERE id = 'default'
                LIMIT 1;
                
                -- If default workspace doesn't exist, create it
                IF default_workspace_id IS NULL THEN
                    INSERT INTO public.workspaces (id, name)
                    VALUES ('default', 'Marketing Hub')
                    ON CONFLICT (id) DO NOTHING
                    RETURNING id INTO default_workspace_id;
                END IF;
                
                -- Set NULL workspace_id values to 'default'
                UPDATE public.workspace_settings
                SET workspace_id = 'default'::text
                WHERE workspace_id IS NULL;
                
                RAISE NOTICE 'Updated % NULL workspace_id values to default (text)', null_count;
            ELSIF col_data_type = 'uuid' THEN
                -- For uuid type, try to use first available workspace
                -- Don't delete - these might be valid settings for single-workspace apps
                SELECT id INTO default_workspace_id
                FROM public.workspaces
                ORDER BY created_at ASC
                LIMIT 1;
                
                IF default_workspace_id IS NOT NULL THEN
                    -- Set NULL workspace_id values to first available workspace
                    UPDATE public.workspace_settings
                    SET workspace_id = default_workspace_id
                    WHERE workspace_id IS NULL;
                    
                    RAISE NOTICE 'Updated % NULL workspace_id values to workspace: % (uuid type)', null_count, default_workspace_id;
                ELSE
                    -- No workspace exists - skip NOT NULL constraint
                    RAISE WARNING 'Skipping NOT NULL constraint on workspace_settings.workspace_id - no workspace exists and % rows have NULL values. Please create a workspace first.', null_count;
                    RETURN;
                END IF;
            ELSE
                -- Unknown type, skip
                RAISE WARNING 'Skipping NOT NULL constraint on workspace_settings.workspace_id - unknown data type: %', col_data_type;
                RETURN;
            END IF;
        END IF;
        
        -- Now add NOT NULL constraint (if we handled NULLs or there were none)
        ALTER TABLE public.workspace_settings
        ALTER COLUMN workspace_id SET NOT NULL;
        
        RAISE NOTICE 'Added NOT NULL constraint to workspace_settings.workspace_id';
    END IF;
END $$;

-- ============================================================================
-- SECTION 7: Add Comments for Documentation
-- ============================================================================
-- Add comments to document deprecated tables and relationships

COMMENT ON TABLE public.table_briefings_1766847886126 IS 
    'DEPRECATED: Older version of briefings table. Use table_briefings_1768073365356 instead.';

COMMENT ON TABLE public.table_campaigns_1766847958019 IS 
    'DEPRECATED: Older version of campaigns table. Use table_campaigns_1768074134170 instead.';

COMMENT ON TABLE public.table_contacts_1766847128905 IS 
    'DEPRECATED: Older version of contacts table. Use table_contact_1768073851531 instead.';

COMMENT ON TABLE public.table_content_1767726395418 IS 
    'DEPRECATED: Older version of content table. Use table_content_1768242820540 instead.';

COMMENT ON TABLE public.table_sponsorships_1766847842576 IS 
    'DEPRECATED: Older version of sponsorships table. Use table_sponsorships_1768074191424 instead.';

-- ============================================================================
-- SECTION 8: Prevent Circular References in Views
-- ============================================================================
-- Add a check constraint to prevent circular references in views.default_view

-- Add a function to check for circular references
CREATE OR REPLACE FUNCTION check_view_circular_reference()
RETURNS TRIGGER AS $function$
DECLARE
    current_id uuid;
    next_id uuid;
    depth integer := 0;
BEGIN
    -- Only check if default_view is being set
    IF NEW.default_view IS NULL THEN
        RETURN NEW;
    END IF;
    
    current_id := NEW.id;
    next_id := NEW.default_view;
    
    -- Prevent direct self-reference
    IF current_id = next_id THEN
        RAISE EXCEPTION 'View cannot reference itself as default_view';
    END IF;
    
    -- Check for circular references up to 10 levels deep
    WHILE next_id IS NOT NULL AND depth < 10 LOOP
        SELECT default_view INTO next_id
        FROM public.views
        WHERE id = next_id;
        
        IF next_id = current_id THEN
            RAISE EXCEPTION 'Circular reference detected in views.default_view chain';
        END IF;
        
        depth := depth + 1;
    END LOOP;
    
    RETURN NEW;
END;
$function$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS prevent_view_circular_reference ON public.views;
CREATE TRIGGER prevent_view_circular_reference
    BEFORE INSERT OR UPDATE OF default_view ON public.views
    FOR EACH ROW
    EXECUTE FUNCTION check_view_circular_reference();

-- ============================================================================
-- SECTION 9: Add Missing Columns to grid_view_settings
-- ============================================================================
-- Ensure grid_view_settings has all required columns, including group_by_rules

DO $$
BEGIN
    -- Add group_by_rules column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'grid_view_settings'
        AND column_name = 'group_by_rules'
    ) THEN
        ALTER TABLE public.grid_view_settings
        ADD COLUMN group_by_rules JSONB DEFAULT NULL;
        
        -- Migrate existing group_by_field to group_by_rules format
        -- Convert single field to array format: [{ type: 'field', field: 'field_name' }]
        UPDATE public.grid_view_settings
        SET group_by_rules = jsonb_build_array(
            jsonb_build_object('type', 'field', 'field', group_by_field)
        )
        WHERE group_by_field IS NOT NULL
        AND group_by_rules IS NULL;
        
        -- Add comment for documentation
        COMMENT ON COLUMN public.grid_view_settings.group_by_rules IS 
            'JSON array of grouping rules. Each rule is { type: "field", field: "field_name" } or { type: "date", field: "field_name", granularity: "year"|"month" }';
        
        RAISE NOTICE 'Added group_by_rules column to grid_view_settings';
    ELSE
        RAISE NOTICE 'group_by_rules column already exists in grid_view_settings';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Summary of changes:
-- 1. ✅ Renamed invalid column name (3rd_party...)
-- 2. ✅ Added missing foreign key constraints
-- 3. ✅ Added indexes for foreign keys
-- 4. ✅ Added ON DELETE behaviors to existing FKs
-- 5. ✅ Converted untyped ARRAY columns to text[]
-- 6. ✅ Added NOT NULL constraints where appropriate
-- 7. ✅ Added documentation comments for deprecated tables
-- 8. ✅ Added trigger to prevent circular references
-- 9. ✅ Added missing group_by_rules column to grid_view_settings
-- ============================================================================
