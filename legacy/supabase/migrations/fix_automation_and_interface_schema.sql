-- Migration: Fix automation tables and interface_pages schema
-- This fixes the automation_runs, automation_logs, and interface_pages tables to match the actual migrations

-- ============================================================================
-- 1. FIX automation_runs TABLE
-- ============================================================================

-- Drop old constraints and columns
ALTER TABLE automation_runs
  DROP CONSTRAINT IF EXISTS automation_runs_status_check,
  DROP COLUMN IF EXISTS input,
  DROP COLUMN IF EXISTS output,
  DROP COLUMN IF EXISTS executed_at;

-- Add correct columns
ALTER TABLE automation_runs
  ADD COLUMN IF NOT EXISTS started_at timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS context jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- Update status constraint to correct values
ALTER TABLE automation_runs
  ADD CONSTRAINT automation_runs_status_check 
  CHECK (status IN ('running', 'completed', 'failed', 'stopped'));

-- Update foreign key to include ON DELETE CASCADE
ALTER TABLE automation_runs
  DROP CONSTRAINT IF EXISTS automation_runs_automation_id_fkey;

ALTER TABLE automation_runs
  ADD CONSTRAINT automation_runs_automation_id_fkey 
  FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE;

-- Make automation_id NOT NULL if it isn't already
ALTER TABLE automation_runs
  ALTER COLUMN automation_id SET NOT NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_id ON automation_runs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON automation_runs(status);
CREATE INDEX IF NOT EXISTS idx_automation_runs_started_at ON automation_runs(started_at);

-- ============================================================================
-- 2. FIX automation_logs TABLE
-- ============================================================================

-- Drop old constraints and columns
ALTER TABLE automation_logs
  DROP CONSTRAINT IF EXISTS automation_logs_status_check,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS input,
  DROP COLUMN IF EXISTS output,
  DROP COLUMN IF EXISTS error,
  DROP COLUMN IF EXISTS duration_ms,
  DROP COLUMN IF EXISTS timestamp;

-- Add correct columns
ALTER TABLE automation_logs
  ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES automation_runs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- Add level constraint
ALTER TABLE automation_logs
  ADD CONSTRAINT automation_logs_level_check 
  CHECK (level IN ('info', 'warning', 'error'));

-- Update foreign keys to include ON DELETE CASCADE
ALTER TABLE automation_logs
  DROP CONSTRAINT IF EXISTS automation_logs_automation_id_fkey;

ALTER TABLE automation_logs
  ADD CONSTRAINT automation_logs_automation_id_fkey 
  FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_run_id ON automation_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON automation_logs(created_at);

-- ============================================================================
-- 3. FIX interface_pages page_type CONSTRAINT
-- ============================================================================

-- Remove 'blank' from page_type constraint
ALTER TABLE interface_pages
  DROP CONSTRAINT IF EXISTS interface_pages_page_type_check;

ALTER TABLE interface_pages
  ADD CONSTRAINT interface_pages_page_type_check 
  CHECK (page_type IN ('list', 'gallery', 'kanban', 'calendar', 'timeline', 'form', 'dashboard', 'overview', 'record_review'));

-- Update any existing 'blank' pages to 'overview'
UPDATE interface_pages
SET page_type = 'overview'
WHERE page_type = 'blank';

-- Add indexes for anchor columns
CREATE INDEX IF NOT EXISTS idx_interface_pages_saved_view_id ON interface_pages(saved_view_id) WHERE saved_view_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interface_pages_dashboard_layout_id ON interface_pages(dashboard_layout_id) WHERE dashboard_layout_id IS NOT NULL;

-- ============================================================================
-- 4. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE automation_runs IS 'Tracks execution of automations with status: running, completed, failed, or stopped';
COMMENT ON COLUMN automation_runs.started_at IS 'When the automation run started';
COMMENT ON COLUMN automation_runs.completed_at IS 'When the automation run completed (null if still running or failed)';
COMMENT ON COLUMN automation_runs.context IS 'JSONB context data for the automation run';

COMMENT ON TABLE automation_logs IS 'Detailed logs for automation execution with levels: info, warning, or error';
COMMENT ON COLUMN automation_logs.run_id IS 'Optional reference to the automation run this log belongs to';
COMMENT ON COLUMN automation_logs.level IS 'Log level: info, warning, or error';
COMMENT ON COLUMN automation_logs.message IS 'Log message text';
COMMENT ON COLUMN automation_logs.data IS 'Additional JSONB data for the log entry';

COMMENT ON COLUMN interface_pages.page_type IS 'Page visualization type. Blank pages are not allowed - use overview instead.';

