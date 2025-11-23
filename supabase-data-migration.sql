-- ============================================
-- DATA MIGRATION SCRIPT
-- Migrates data from legacy tables to new dynamic system
-- Run this AFTER supabase-dynamic-system-migration.sql
-- ============================================

-- ============================================
-- 1. MIGRATE TABLE_METADATA → TABLES
-- ============================================

-- Migrate table_metadata to new tables system
INSERT INTO tables (name, label, description, icon, color, created_at, updated_at)
SELECT 
  table_name,
  display_name,
  COALESCE(description, ''),
  'table' as icon, -- Default icon, can be customized later
  '#6366f1' as color, -- Default color, can be customized later
  created_at,
  updated_at
FROM table_metadata
WHERE NOT EXISTS (
  SELECT 1 FROM tables WHERE tables.name = table_metadata.table_name
)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 2. MIGRATE DASHBOARDS → PAGES
-- ============================================

-- Migrate dashboards to pages
INSERT INTO pages (name, icon, layout, created_at, updated_at)
SELECT 
  COALESCE(name, 'Untitled Dashboard'),
  'layout-dashboard' as icon,
  'dashboard' as layout,
  COALESCE(created_at, NOW()),
  COALESCE(updated_at, NOW())
FROM dashboards
WHERE NOT EXISTS (
  SELECT 1 FROM pages WHERE pages.name = COALESCE(dashboards.name, 'Untitled Dashboard')
)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. MIGRATE DASHBOARD_MODULES → PAGE_BLOCKS
-- ============================================

-- Migrate dashboard_modules to page_blocks
-- First, we need to map dashboard_id to page_id
INSERT INTO page_blocks (
  page_id,
  type,
  position_x,
  position_y,
  width,
  height,
  config,
  created_at,
  updated_at
)
SELECT 
  p.id as page_id,
  CASE 
    WHEN dm.type = 'kpi' THEN 'kpi'
    WHEN dm.type = 'pipeline' THEN 'kanban'
    WHEN dm.type = 'tasks_due' THEN 'list'
    WHEN dm.type = 'upcoming_events' THEN 'calendar'
    WHEN dm.type = 'calendar_mini' THEN 'calendar'
    WHEN dm.type = 'table_preview' THEN 'grid'
    WHEN dm.type = 'custom_embed' THEN 'text'
    ELSE 'text'
  END as type,
  COALESCE(dm.position_x, 0) as position_x,
  COALESCE(dm.position_y, 0) as position_y,
  COALESCE(dm.width, 12) as width,
  COALESCE(dm.height, 6) as height,
  COALESCE(dm.config, '{}'::jsonb) as config,
  COALESCE(dm.created_at, NOW()) as created_at,
  COALESCE(dm.updated_at, NOW()) as updated_at
FROM dashboard_modules dm
LEFT JOIN dashboards d ON dm.dashboard_id = d.id
LEFT JOIN pages p ON p.name = COALESCE(d.name, 'Untitled Dashboard')
WHERE p.id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. MIGRATE DASHBOARD_BLOCKS → PAGE_BLOCKS
-- ============================================

-- Migrate dashboard_blocks to page_blocks (if they exist separately)
INSERT INTO page_blocks (
  page_id,
  type,
  position_x,
  position_y,
  width,
  height,
  config,
  created_at,
  updated_at
)
SELECT 
  p.id as page_id,
  COALESCE(db.type, 'text') as type,
  COALESCE(db.position_x, 0) as position_x,
  COALESCE(db.position_y, 0) as position_y,
  COALESCE(db.width, 12) as width,
  COALESCE(db.height, 6) as height,
  COALESCE(db.config, '{}'::jsonb) as config,
  COALESCE(db.created_at, NOW()) as created_at,
  COALESCE(db.updated_at, NOW()) as updated_at
FROM dashboard_blocks db
LEFT JOIN dashboards d ON db.dashboard_id = d.id
LEFT JOIN pages p ON p.name = COALESCE(d.name, 'Untitled Dashboard')
WHERE p.id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM page_blocks pb 
    WHERE pb.page_id = p.id 
    AND pb.position_x = COALESCE(db.position_x, 0)
    AND pb.position_y = COALESCE(db.position_y, 0)
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. VERIFICATION QUERIES
-- ============================================

-- Check migration results
SELECT 
  'Tables migrated' as migration_step,
  COUNT(*) as count
FROM tables
UNION ALL
SELECT 
  'Pages migrated' as migration_step,
  COUNT(*) as count
FROM pages
UNION ALL
SELECT 
  'Page blocks migrated' as migration_step,
  COUNT(*) as count
FROM page_blocks;

-- Show migrated tables
SELECT name, label, description FROM tables ORDER BY created_at;

-- Show migrated pages
SELECT name, layout FROM pages ORDER BY created_at;

-- ============================================
-- 6. IMPORTANT NOTES
-- ============================================

-- ⚠️ THIS MIGRATION DOES NOT DELETE ANY DATA TABLES ⚠️
-- 
-- Your actual data tables are SAFE and UNTOUCHED:
-- ✅ content (649 rows) - KEPT
-- ✅ campaigns - KEPT
-- ✅ contacts - KEPT
-- ✅ ideas - KEPT
-- ✅ media - KEPT
-- ✅ tasks - KEPT
-- ✅ briefings - KEPT
-- ✅ sponsorships - KEPT
-- ✅ strategy - KEPT
-- ✅ assets - KEPT
-- ✅ All other data tables - KEPT
--
-- This migration ONLY:
-- 1. Creates new metadata tables (tables, table_fields, pages, page_blocks)
-- 2. Migrates metadata FROM old config tables TO new metadata tables
-- 3. Does NOT touch your actual data
--
-- After running this migration:
-- 1. Verify data was migrated correctly
-- 2. Test the new /tables and /pages routes
-- 3. Legacy metadata tables (table_metadata, dashboard_modules, etc.) can be kept for reference
-- 4. Your actual data tables remain unchanged and accessible
-- 5. Update any code that still references table_metadata, dashboard_modules, etc.

