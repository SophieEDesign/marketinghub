-- Simple Schema Fixes
-- Run this if you want direct ALTER statements (less safe but simpler)

-- ============================================
-- 1. Remove invalid ARRAY columns from campaigns
-- ============================================
ALTER TABLE public.campaigns DROP COLUMN IF EXISTS content;
ALTER TABLE public.campaigns DROP COLUMN IF EXISTS sponsorships;
ALTER TABLE public.campaigns DROP COLUMN IF EXISTS content_calendar_from_sponsorships;

-- ============================================
-- 2. Fix content table ARRAY types
-- ============================================
-- Fix channels to be text[]
ALTER TABLE public.content 
ALTER COLUMN channels TYPE text[] 
USING CASE 
    WHEN channels IS NULL THEN '{}'::text[]
    WHEN pg_typeof(channels)::text = 'text[]' THEN channels::text[]
    ELSE ARRAY[]::text[]
END;

-- Fix attachments to be uuid[] (or text[] if you prefer)
-- Option A: uuid[] (if attachments reference other tables)
ALTER TABLE public.content 
ALTER COLUMN attachments TYPE uuid[] 
USING CASE 
    WHEN attachments IS NULL THEN '{}'::uuid[]
    WHEN pg_typeof(attachments)::text = 'uuid[]' THEN attachments::uuid[]
    ELSE ARRAY[]::uuid[]
END;

-- Option B: text[] (if attachments are just URLs/paths) - uncomment if preferred
-- ALTER TABLE public.content 
-- ALTER COLUMN attachments TYPE text[] 
-- USING CASE 
--     WHEN attachments IS NULL THEN '{}'::text[]
--     WHEN pg_typeof(attachments)::text = 'text[]' THEN attachments::text[]
--     ELSE ARRAY[]::text[]
-- END;

-- ============================================
-- 3. Ensure table_fields.order is properly typed
-- ============================================
-- The column should already be quoted, but ensure it's integer
ALTER TABLE public.table_fields 
ALTER COLUMN "order" TYPE integer 
USING CASE 
    WHEN "order" IS NULL THEN 0
    ELSE "order"::integer
END;

-- ============================================
-- 4. Fix campaigns.assignee type (optional)
-- ============================================
-- Only run this if you want assignee to be uuid instead of text
-- Make sure all existing values are valid UUIDs first!
-- ALTER TABLE public.campaigns 
-- ALTER COLUMN assignee TYPE uuid 
-- USING CASE 
--     WHEN assignee IS NULL OR assignee = '' THEN NULL
--     ELSE assignee::uuid
-- END;

-- ============================================
-- 5. Add missing columns if needed
-- ============================================
-- Add created column to campaigns if it doesn't exist
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS created timestamp with time zone DEFAULT now();

-- Ensure dashboard_blocks has grid layout columns
ALTER TABLE public.dashboard_blocks 
ADD COLUMN IF NOT EXISTS position_x integer DEFAULT 0;

ALTER TABLE public.dashboard_blocks 
ADD COLUMN IF NOT EXISTS position_y integer DEFAULT 0;

ALTER TABLE public.dashboard_blocks 
ADD COLUMN IF NOT EXISTS width integer DEFAULT 3;

ALTER TABLE public.dashboard_blocks 
ADD COLUMN IF NOT EXISTS height integer DEFAULT 3;
