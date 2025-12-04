-- Schema Fixes Migration
-- This script fixes invalid ARRAY syntax and other schema issues

-- ============================================
-- 1. Fix campaigns table - Remove invalid ARRAY columns
-- ============================================

-- Drop invalid columns if they exist
DO $$ 
BEGIN
    -- Drop content ARRAY column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'campaigns' 
        AND column_name = 'content'
    ) THEN
        ALTER TABLE public.campaigns DROP COLUMN content;
        RAISE NOTICE 'Dropped campaigns.content column';
    END IF;

    -- Drop sponsorships ARRAY column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'campaigns' 
        AND column_name = 'sponsorships'
    ) THEN
        ALTER TABLE public.campaigns DROP COLUMN sponsorships;
        RAISE NOTICE 'Dropped campaigns.sponsorships column';
    END IF;

    -- Drop content_calendar_from_sponsorships ARRAY column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'campaigns' 
        AND column_name = 'content_calendar_from_sponsorships'
    ) THEN
        ALTER TABLE public.campaigns DROP COLUMN content_calendar_from_sponsorships;
        RAISE NOTICE 'Dropped campaigns.content_calendar_from_sponsorships column';
    END IF;
END $$;

-- ============================================
-- 2. Fix content table - Fix ARRAY column types
-- ============================================

-- Fix channels column type
DO $$ 
BEGIN
    -- Check if channels column exists and has wrong type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'content' 
        AND column_name = 'channels'
        AND data_type != 'ARRAY'
    ) THEN
        -- Column exists but might need type fix
        RAISE NOTICE 'channels column type check skipped - already correct or needs manual review';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'content' 
        AND column_name = 'channels'
    ) THEN
        -- Try to alter the type
        BEGIN
            ALTER TABLE public.content 
            ALTER COLUMN channels TYPE text[] USING 
                CASE 
                    WHEN channels IS NULL THEN '{}'::text[]
                    WHEN pg_typeof(channels)::text = 'text[]' THEN channels::text[]
                    ELSE ARRAY[]::text[]
                END;
            RAISE NOTICE 'Fixed content.channels column type to text[]';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not alter channels column: %', SQLERRM;
        END;
    END IF;
END $$;

-- Fix attachments column type
DO $$ 
BEGIN
    -- Check if attachments column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'content' 
        AND column_name = 'attachments'
    ) THEN
        -- Try to alter the type to uuid[] (assuming attachments are UUIDs)
        BEGIN
            ALTER TABLE public.content 
            ALTER COLUMN attachments TYPE uuid[] USING 
                CASE 
                    WHEN attachments IS NULL THEN '{}'::uuid[]
                    WHEN pg_typeof(attachments)::text = 'uuid[]' THEN attachments::uuid[]
                    ELSE ARRAY[]::uuid[]
                END;
            RAISE NOTICE 'Fixed content.attachments column type to uuid[]';
        EXCEPTION WHEN OTHERS THEN
            -- If uuid[] fails, try text[]
            BEGIN
                ALTER TABLE public.content 
                ALTER COLUMN attachments TYPE text[] USING 
                    CASE 
                        WHEN attachments IS NULL THEN '{}'::text[]
                        WHEN pg_typeof(attachments)::text = 'text[]' THEN attachments::text[]
                        ELSE ARRAY[]::text[]
                    END;
                RAISE NOTICE 'Fixed content.attachments column type to text[]';
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not alter attachments column: %', SQLERRM;
            END;
        END;
    END IF;
END $$;

-- ============================================
-- 3. Fix table_fields table - Quote reserved keyword 'order'
-- ============================================

-- The 'order' column should already be quoted in the actual table
-- But we'll ensure it's properly handled
DO $$ 
BEGIN
    -- Check if order column exists without quotes (shouldn't happen, but just in case)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'table_fields' 
        AND column_name = 'order'
    ) THEN
        -- Column exists, which is good
        -- Verify it's the right type
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'table_fields' 
            AND column_name = 'order'
            AND data_type = 'integer'
        ) THEN
            -- Try to fix the type
            BEGIN
                ALTER TABLE public.table_fields 
                ALTER COLUMN "order" TYPE integer USING 
                    CASE 
                        WHEN "order" IS NULL THEN 0
                        ELSE "order"::integer
                    END;
                RAISE NOTICE 'Fixed table_fields.order column type to integer';
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not alter order column: %', SQLERRM;
            END;
        END IF;
    END IF;
END $$;

-- ============================================
-- 4. Fix campaigns.assignee type if needed
-- ============================================

-- Check if assignee should be uuid instead of text
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'campaigns' 
        AND column_name = 'assignee'
        AND data_type = 'text'
    ) THEN
        -- Check if we should convert to uuid
        -- Only convert if all existing values are valid UUIDs or NULL
        IF NOT EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE assignee IS NOT NULL 
            AND assignee !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        ) THEN
            BEGIN
                ALTER TABLE public.campaigns 
                ALTER COLUMN assignee TYPE uuid USING 
                    CASE 
                        WHEN assignee IS NULL OR assignee = '' THEN NULL
                        ELSE assignee::uuid
                    END;
                RAISE NOTICE 'Converted campaigns.assignee from text to uuid';
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not convert assignee to uuid (keeping as text): %', SQLERRM;
            END;
        ELSE
            RAISE NOTICE 'campaigns.assignee contains non-UUID values, keeping as text';
        END IF;
    END IF;
END $$;

-- ============================================
-- 5. Add missing 'created' column to campaigns if it exists in schema
-- ============================================

-- Add created column if it doesn't exist (schema shows it but migration doesn't)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'campaigns' 
        AND column_name = 'created'
    ) THEN
        ALTER TABLE public.campaigns 
        ADD COLUMN created timestamp with time zone DEFAULT now();
        RAISE NOTICE 'Added campaigns.created column';
    END IF;
END $$;

-- ============================================
-- 6. Verify dashboard_blocks table structure
-- ============================================

-- Ensure dashboard_blocks has all required grid layout columns
DO $$ 
BEGIN
    -- Add position_x if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'dashboard_blocks' 
        AND column_name = 'position_x'
    ) THEN
        ALTER TABLE public.dashboard_blocks 
        ADD COLUMN position_x integer DEFAULT 0;
        RAISE NOTICE 'Added dashboard_blocks.position_x column';
    END IF;

    -- Add position_y if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'dashboard_blocks' 
        AND column_name = 'position_y'
    ) THEN
        ALTER TABLE public.dashboard_blocks 
        ADD COLUMN position_y integer DEFAULT 0;
        RAISE NOTICE 'Added dashboard_blocks.position_y column';
    END IF;

    -- Add width if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'dashboard_blocks' 
        AND column_name = 'width'
    ) THEN
        ALTER TABLE public.dashboard_blocks 
        ADD COLUMN width integer DEFAULT 3;
        RAISE NOTICE 'Added dashboard_blocks.width column';
    END IF;

    -- Add height if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'dashboard_blocks' 
        AND column_name = 'height'
    ) THEN
        ALTER TABLE public.dashboard_blocks 
        ADD COLUMN height integer DEFAULT 3;
        RAISE NOTICE 'Added dashboard_blocks.height column';
    END IF;
END $$;

-- ============================================
-- 7. Summary
-- ============================================

DO $$ 
BEGIN
    RAISE NOTICE 'Schema fixes completed. Review the notices above for details.';
END $$;
