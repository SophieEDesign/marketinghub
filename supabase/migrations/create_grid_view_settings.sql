-- Migration: Create Grid View Settings Table
-- This migration creates a separate table for grid-specific view settings
-- to keep grid view settings separate from general view configuration

-- Create grid_view_settings table
CREATE TABLE IF NOT EXISTS grid_view_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id UUID NOT NULL REFERENCES views(id) ON DELETE CASCADE,
  group_by_field TEXT, -- Field name to group by
  column_widths JSONB DEFAULT '{}'::jsonb, -- Map of field_name -> width in pixels
  column_order JSONB DEFAULT '[]'::jsonb, -- Array of field names in display order
  column_wrap_text JSONB DEFAULT '{}'::jsonb, -- Map of field_name -> boolean for text wrapping
  row_height TEXT DEFAULT 'medium' CHECK (row_height IN ('short', 'medium', 'tall')),
  frozen_columns INTEGER DEFAULT 0, -- Number of frozen columns
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(view_id) -- One settings record per view
);

-- Create index for view_id lookups
CREATE INDEX IF NOT EXISTS idx_grid_view_settings_view_id ON grid_view_settings(view_id);

-- Create trigger for updated_at
CREATE TRIGGER update_grid_view_settings_updated_at
  BEFORE UPDATE ON grid_view_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE grid_view_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for grid_view_settings
-- Users can read grid settings if they can read the view
CREATE POLICY "Users can read grid view settings for accessible views"
  ON grid_view_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM views
      WHERE views.id = grid_view_settings.view_id
      AND (
        EXISTS (
          SELECT 1 FROM tables
          WHERE tables.id = views.table_id
          AND (
            tables.access_control = 'public'
            OR (tables.access_control = 'authenticated' AND auth.role() = 'authenticated')
            OR (tables.access_control = 'owner' AND tables.created_by = auth.uid())
          )
        )
      )
    )
  );

-- Users can insert/update grid settings if they can update the view
CREATE POLICY "Users can manage grid view settings for accessible views"
  ON grid_view_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM views
      WHERE views.id = grid_view_settings.view_id
      AND EXISTS (
        SELECT 1 FROM tables
        WHERE tables.id = views.table_id
        AND (
          tables.access_control = 'public'
          OR tables.access_control = 'authenticated'
          OR (tables.access_control = 'owner' AND tables.created_by = auth.uid())
        )
      )
    )
  );

-- Migrate existing grid view settings from views.config
-- This moves groupBy and other grid-specific settings to the new table
INSERT INTO grid_view_settings (view_id, group_by_field, column_widths, column_order, row_height)
SELECT 
  id as view_id,
  (config->>'groupBy')::TEXT as group_by_field,
  COALESCE((config->>'columnWidths')::jsonb, '{}'::jsonb) as column_widths,
  COALESCE((config->>'columnOrder')::jsonb, '[]'::jsonb) as column_order,
  COALESCE(config->>'rowHeight', 'medium') as row_height
FROM views
WHERE type = 'grid'
  AND (config IS NOT NULL AND config != '{}'::jsonb)
  AND (
    config ? 'groupBy' 
    OR config ? 'columnWidths' 
    OR config ? 'columnOrder' 
    OR config ? 'rowHeight'
  )
ON CONFLICT (view_id) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE grid_view_settings IS 'Grid-specific settings for grid views, separate from general view configuration';
COMMENT ON COLUMN grid_view_settings.column_widths IS 'JSON object mapping field names to column widths in pixels';
COMMENT ON COLUMN grid_view_settings.column_order IS 'JSON array of field names in display order';
COMMENT ON COLUMN grid_view_settings.column_wrap_text IS 'JSON object mapping field names to text wrap boolean';

