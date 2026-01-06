-- Migration: Add Filter Block Support
-- Date: 2025-01-XX
-- 
-- This migration documents that filter blocks are now supported.
-- No schema changes are required as:
-- 1. view_blocks.type is text (no CHECK constraint limiting types)
-- 2. view_blocks.config is jsonb (can store filter block config)
--
-- Filter block configuration is stored in view_blocks.config as:
-- {
--   "filters": FilterConfig[],
--   "target_blocks": "all" | string[],
--   "allowed_fields": string[],
--   "allowed_operators": string[]
-- }
--
-- Block base filters are also stored in view_blocks.config.filters as BlockFilter[]

-- No schema changes needed - existing schema supports filter blocks
-- This migration file exists for documentation purposes

-- Optional: Add comment to document filter block support
COMMENT ON COLUMN public.view_blocks.type IS 'Block type: grid, form, record, chart, kpi, text, image, divider, button, tabs, table_snapshot, action, link_preview, filter, etc.';
COMMENT ON COLUMN public.view_blocks.config IS 'Block configuration (JSONB). For filter blocks, contains: filters, target_blocks, allowed_fields, allowed_operators. For data blocks, contains: filters (base filters), table_id, view_id, etc.';

