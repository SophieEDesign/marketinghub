-- Migration: Add trigger_type and trigger_config columns to automations table
-- This fixes the schema mismatch where code expects trigger_type/trigger_config
-- but the database only has a trigger JSONB field

-- ============================================================================
-- 1. ADD MISSING COLUMNS
-- ============================================================================

-- Add trigger_type column
ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS trigger_type text;

-- Add trigger_config column
ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS trigger_config jsonb DEFAULT '{}';

-- Add table_id column if missing (needed by TypeScript types)
ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS table_id uuid;

-- ============================================================================
-- 2. MIGRATE DATA FROM trigger JSONB TO NEW COLUMNS
-- ============================================================================

-- Extract trigger_type and trigger_config from trigger JSONB
-- The trigger JSONB should have structure: { type: 'row_created', ...config }
UPDATE automations
SET 
  trigger_type = COALESCE(
    trigger_type,
    CASE 
      WHEN trigger->>'type' IS NOT NULL THEN trigger->>'type'
      WHEN trigger->>'trigger_type' IS NOT NULL THEN trigger->>'trigger_type'
      ELSE 'row_created' -- Default fallback
    END
  ),
  trigger_config = COALESCE(
    trigger_config,
    CASE 
      WHEN trigger->'config' IS NOT NULL THEN trigger->'config'
      WHEN trigger ? 'table_id' OR trigger ? 'interval' OR trigger ? 'webhook_id' THEN trigger
      ELSE '{}'::jsonb
    END
  ),
  table_id = COALESCE(
    table_id,
    CASE 
      WHEN trigger->>'table_id' IS NOT NULL THEN (trigger->>'table_id')::uuid
      WHEN trigger->'config'->>'table_id' IS NOT NULL THEN (trigger->'config'->>'table_id')::uuid
      ELSE NULL
    END
  )
WHERE trigger IS NOT NULL
  AND (trigger_type IS NULL OR trigger_config IS NULL);

-- ============================================================================
-- 3. ADD CONSTRAINTS AND INDEXES
-- ============================================================================

-- Add index on trigger_type for faster queries
CREATE INDEX IF NOT EXISTS idx_automations_trigger_type ON automations(trigger_type);

-- Add index on table_id for faster queries
CREATE INDEX IF NOT EXISTS idx_automations_table_id ON automations(table_id) WHERE table_id IS NOT NULL;

-- ============================================================================
-- 4. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN automations.trigger_type IS 'Type of trigger: row_created, row_updated, row_deleted, schedule, webhook, or condition';
COMMENT ON COLUMN automations.trigger_config IS 'Configuration for the trigger (table_id, interval, webhook_id, etc.)';
COMMENT ON COLUMN automations.table_id IS 'Optional table ID for table-related triggers';
