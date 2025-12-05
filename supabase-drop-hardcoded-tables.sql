-- ============================================
-- DROP HARDCODED TABLES
-- This script removes all hardcoded data tables
-- Tables are dropped in order to respect foreign key constraints
-- ============================================

-- Drop tables that reference other tables first (child tables)
-- These have foreign keys to content or campaigns

-- Drop child tables of content
DROP TABLE IF EXISTS public.assets CASCADE;
DROP TABLE IF EXISTS public.briefings CASCADE;
DROP TABLE IF EXISTS public.media CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;

-- Drop content table (referenced by above tables and references campaigns)
DROP TABLE IF EXISTS public.content CASCADE;

-- Drop campaigns table (referenced by content)
DROP TABLE IF EXISTS public.campaigns CASCADE;

-- Drop other independent hardcoded tables
DROP TABLE IF EXISTS public.contacts CASCADE;
DROP TABLE IF EXISTS public.ideas CASCADE;
DROP TABLE IF EXISTS public.sponsorships CASCADE;
DROP TABLE IF EXISTS public.strategy CASCADE;

-- Note: Keep these system tables:
-- - tables (dynamic table metadata)
-- - table_fields (dynamic field definitions)
-- - table_metadata (legacy, but may still be in use)
-- - table_view_configs (view configurations)
-- - pages (interface pages)
-- - page_blocks (page blocks)
-- - dashboards (dashboard system)
-- - dashboard_blocks (dashboard blocks)
-- - dashboard_modules (dashboard modules)
-- - automations (automation system)
-- - automation_logs (automation logs)
-- - comments (comments system)
-- - settings (app settings)
-- - sidebar_categories (sidebar categories)
-- - sidebar_items (sidebar items)
-- - user_roles (user roles)

-- ============================================
-- VERIFY CLEANUP
-- ============================================

-- After running this, you should only have:
-- 1. System tables (tables, table_fields, etc.)
-- 2. Dynamically created tables (created via create_dynamic_table function)

-- To verify, run:
-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_schema = 'public' 
--   AND table_type = 'BASE TABLE'
-- ORDER BY table_name;
