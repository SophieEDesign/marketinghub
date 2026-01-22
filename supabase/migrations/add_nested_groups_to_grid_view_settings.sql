-- Migration: Add nested groups support to grid_view_settings
-- This migration adds a group_by_rules JSONB column to support multiple grouping levels

-- Add group_by_rules column to store array of grouping rules
ALTER TABLE grid_view_settings
ADD COLUMN IF NOT EXISTS group_by_rules JSONB DEFAULT NULL;

-- Migrate existing group_by_field to group_by_rules format
-- Convert single field to array format: [{ type: 'field', field: 'field_name' }]
UPDATE grid_view_settings
SET group_by_rules = jsonb_build_array(
  jsonb_build_object('type', 'field', 'field', group_by_field)
)
WHERE group_by_field IS NOT NULL
  AND group_by_rules IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN grid_view_settings.group_by_rules IS 'JSON array of grouping rules. Each rule is { type: "field", field: "field_name" } or { type: "date", field: "field_name", granularity: "year"|"month" }';
