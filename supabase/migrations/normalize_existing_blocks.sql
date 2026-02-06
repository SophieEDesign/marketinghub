-- Migration: Normalize existing blocks and add missing defaults
-- This migration ensures all existing blocks have proper default settings
-- based on the standardized block defaults from BLOCK_REGISTRY

-- Function to normalize block configs
CREATE OR REPLACE FUNCTION normalize_block_configs()
RETURNS void AS $$
DECLARE
  block_record RECORD;
  normalized_config JSONB;
  block_type TEXT;
BEGIN
  -- Iterate through all blocks
  FOR block_record IN
    SELECT id, type, config
    FROM view_blocks
    WHERE config IS NOT NULL
  LOOP
    block_type := block_record.type;
    normalized_config := block_record.config;
    
    -- Ensure config is an object
    IF jsonb_typeof(normalized_config) != 'object' THEN
      normalized_config := '{}'::jsonb;
    END IF;
    
    -- Add missing title defaults based on block type
    -- (Only if title is missing or empty)
    IF NOT (normalized_config ? 'title') OR normalized_config->>'title' = '' THEN
      CASE block_type
        WHEN 'grid' THEN
          normalized_config := normalized_config || '{"title": "Table View"}'::jsonb;
        WHEN 'form' THEN
          normalized_config := normalized_config || '{"title": "Form"}'::jsonb;
        WHEN 'record' THEN
          normalized_config := normalized_config || '{"title": "Record"}'::jsonb;
        WHEN 'chart' THEN
          normalized_config := normalized_config || '{"title": "Chart"}'::jsonb;
        WHEN 'kpi' THEN
          normalized_config := normalized_config || '{"title": "KPI"}'::jsonb;
        WHEN 'image' THEN
          normalized_config := normalized_config || '{"title": "Image"}'::jsonb;
        WHEN 'gallery' THEN
          normalized_config := normalized_config || '{"title": "Gallery"}'::jsonb;
        WHEN 'button' THEN
          normalized_config := normalized_config || '{"title": "Button"}'::jsonb;
        WHEN 'action' THEN
          normalized_config := normalized_config || '{"title": "Action"}'::jsonb;
        WHEN 'link_preview' THEN
          normalized_config := normalized_config || '{"title": "Link Preview"}'::jsonb;
        WHEN 'filter' THEN
          normalized_config := normalized_config || '{"title": "Filters"}'::jsonb;
        WHEN 'calendar' THEN
          normalized_config := normalized_config || '{"title": "Calendar"}'::jsonb;
        WHEN 'multi_calendar' THEN
          normalized_config := normalized_config || '{"title": "Multi Calendar"}'::jsonb;
        WHEN 'kanban' THEN
          normalized_config := normalized_config || '{"title": "Kanban Board"}'::jsonb;
        WHEN 'timeline' THEN
          normalized_config := normalized_config || '{"title": "Timeline"}'::jsonb;
        WHEN 'multi_timeline' THEN
          normalized_config := normalized_config || '{"title": "Multi Timeline"}'::jsonb;
        WHEN 'list' THEN
          normalized_config := normalized_config || '{"title": "List View"}'::jsonb;
        WHEN 'horizontal_grouped' THEN
          normalized_config := normalized_config || '{"title": "Tabs View"}'::jsonb;
        WHEN 'number' THEN
          normalized_config := normalized_config || '{"title": "Number"}'::jsonb;
        ELSE
          -- For text, field, field_section, divider - keep empty title
          NULL;
      END CASE;
    END IF;
    
    -- Add missing type-specific defaults
    CASE block_type
      WHEN 'chart' THEN
        IF NOT (normalized_config ? 'chart_type') THEN
          normalized_config := normalized_config || '{"chart_type": "bar"}'::jsonb;
        END IF;
      WHEN 'kpi' THEN
        IF NOT (normalized_config ? 'kpi_aggregate') THEN
          normalized_config := normalized_config || '{"kpi_aggregate": "count"}'::jsonb;
        END IF;
      WHEN 'gallery' THEN
        IF NOT (normalized_config ? 'view_type') THEN
          normalized_config := normalized_config || '{"view_type": "gallery"}'::jsonb;
        END IF;
      WHEN 'calendar' THEN
        IF NOT (normalized_config ? 'view_type') THEN
          normalized_config := normalized_config || '{"view_type": "calendar"}'::jsonb;
        END IF;
      WHEN 'kanban' THEN
        IF NOT (normalized_config ? 'view_type') THEN
          normalized_config := normalized_config || '{"view_type": "kanban"}'::jsonb;
        END IF;
      WHEN 'timeline' THEN
        IF NOT (normalized_config ? 'view_type') THEN
          normalized_config := normalized_config || '{"view_type": "timeline"}'::jsonb;
        END IF;
      WHEN 'list' THEN
        IF NOT (normalized_config ? 'view_type') THEN
          normalized_config := normalized_config || '{"view_type": "grid"}'::jsonb;
        END IF;
      WHEN 'action' THEN
        IF NOT (normalized_config ? 'action_type') THEN
          normalized_config := normalized_config || '{"action_type": "navigate"}'::jsonb;
        END IF;
        IF NOT (normalized_config ? 'label') OR normalized_config->>'label' = '' THEN
          normalized_config := normalized_config || '{"label": "Click Me"}'::jsonb;
        END IF;
      WHEN 'button' THEN
        IF NOT (normalized_config ? 'button_label') OR normalized_config->>'button_label' = '' THEN
          normalized_config := normalized_config || '{"button_label": "Click Me"}'::jsonb;
        END IF;
      WHEN 'filter' THEN
        IF NOT (normalized_config ? 'target_blocks') THEN
          normalized_config := normalized_config || '{"target_blocks": "all"}'::jsonb;
        END IF;
        IF NOT (normalized_config ? 'allowed_fields') THEN
          normalized_config := normalized_config || '{"allowed_fields": []}'::jsonb;
        END IF;
        IF NOT (normalized_config ? 'filters') THEN
          normalized_config := normalized_config || '{"filters": []}'::jsonb;
        END IF;
      WHEN 'divider' THEN
        -- Ensure appearance.divider_height exists
        IF NOT (normalized_config ? 'appearance') THEN
          normalized_config := normalized_config || '{"appearance": {}}'::jsonb;
        END IF;
        IF NOT ((normalized_config->'appearance') ? 'divider_height') THEN
          normalized_config := jsonb_set(
            normalized_config,
            '{appearance,divider_height}',
            '2'::jsonb
          );
        END IF;
      ELSE
        NULL;
    END CASE;
    
    -- Update the block with normalized config
    UPDATE view_blocks
    SET config = normalized_config
    WHERE id = block_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the normalization
SELECT normalize_block_configs();

-- Drop the function after use
DROP FUNCTION IF EXISTS normalize_block_configs();

-- Add indexes for performance (if not already exist)
CREATE INDEX IF NOT EXISTS idx_view_blocks_config_table_id 
  ON view_blocks USING gin ((config->'table_id'));

CREATE INDEX IF NOT EXISTS idx_view_blocks_config_view_type 
  ON view_blocks USING gin ((config->'view_type'));
