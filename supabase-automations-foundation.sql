-- ============================================
-- AUTOMATIONS SUITE - DATABASE FOUNDATION
-- Creates automations and automation_logs tables with proper RLS
-- ============================================

-- ============================================
-- 1. AUTOMATIONS TABLE
-- ============================================

-- Create table if it doesn't exist (without status column - will be added in migration)
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger JSONB NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrate from old 'enabled' column to new 'status' column if needed
DO $$ 
BEGIN
  -- Check if 'enabled' column exists (old schema)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'automations' AND column_name = 'enabled'
  ) THEN
    -- Add 'status' column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'automations' AND column_name = 'status'
    ) THEN
      ALTER TABLE automations ADD COLUMN status TEXT DEFAULT 'active';
      -- Migrate data: enabled = true -> 'active', enabled = false -> 'paused'
      UPDATE automations SET status = CASE WHEN enabled = true THEN 'active' ELSE 'paused' END;
      -- Make status NOT NULL after migration
      ALTER TABLE automations ALTER COLUMN status SET NOT NULL;
      ALTER TABLE automations ALTER COLUMN status SET DEFAULT 'active';
      -- Add check constraint (drop existing if any)
      ALTER TABLE automations DROP CONSTRAINT IF EXISTS automations_status_check;
      ALTER TABLE automations ADD CONSTRAINT automations_status_check CHECK (status IN ('active', 'paused'));
    END IF;
    -- Drop old 'enabled' column (optional - comment out if you want to keep it)
    -- ALTER TABLE automations DROP COLUMN IF EXISTS enabled;
  END IF;
  
  -- Ensure 'status' column exists (for fresh installs)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'automations' AND column_name = 'status'
  ) THEN
    ALTER TABLE automations ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
    ALTER TABLE automations ADD CONSTRAINT automations_status_check CHECK (status IN ('active', 'paused'));
  END IF;
  
  -- Ensure 'conditions' column exists (it should already exist, but ensure it's correct)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'automations' AND column_name = 'conditions'
  ) THEN
    ALTER TABLE automations ADD COLUMN conditions JSONB NOT NULL DEFAULT '[]'::jsonb;
  ELSE
    -- Ensure conditions has correct default if it exists but might be NULL
    ALTER TABLE automations ALTER COLUMN conditions SET DEFAULT '[]'::jsonb;
    -- Update any NULL values to empty array
    UPDATE automations SET conditions = '[]'::jsonb WHERE conditions IS NULL;
    -- Make it NOT NULL if it isn't already
    ALTER TABLE automations ALTER COLUMN conditions SET NOT NULL;
  END IF;
END $$;

-- Indexes for automations (created AFTER migration ensures status column exists)
-- Only create status index if the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'automations' AND column_name = 'status'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_automations_status ON automations(status);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_automations_created_at ON automations(created_at);

-- ============================================
-- 2. AUTOMATION_LOGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES automations(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  input JSONB,
  output JSONB,
  error TEXT,
  duration_ms INTEGER
);

-- Ensure automation_id is NOT NULL (migrate existing nullable column)
DO $$
BEGIN
  -- Check if automation_id exists and is nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'automation_logs' 
      AND column_name = 'automation_id'
      AND is_nullable = 'YES'
  ) THEN
    -- First, delete any orphaned logs (logs without automation_id)
    DELETE FROM automation_logs WHERE automation_id IS NULL;
    -- Then make it NOT NULL
    ALTER TABLE automation_logs ALTER COLUMN automation_id SET NOT NULL;
  END IF;
  
  -- If column doesn't exist at all, add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'automation_logs' AND column_name = 'automation_id'
  ) THEN
    ALTER TABLE automation_logs ADD COLUMN automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes for automation_logs
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id_timestamp ON automation_logs(automation_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(status);

-- ============================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. RLS POLICIES FOR AUTOMATIONS TABLE
-- ============================================

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Admins can select automations" ON automations;
DROP POLICY IF EXISTS "Authenticated users can select automations" ON automations;
DROP POLICY IF EXISTS "Admins can insert automations" ON automations;
DROP POLICY IF EXISTS "Admins can update automations" ON automations;
DROP POLICY IF EXISTS "Admins can delete automations" ON automations;

-- Admin users can: select, insert, update, delete
CREATE POLICY "Admins can select automations"
  ON automations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert automations"
  ON automations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update automations"
  ON automations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete automations"
  ON automations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Authenticated users can: select only
CREATE POLICY "Authenticated users can select automations"
  ON automations
  FOR SELECT
  TO authenticated
  USING (true);

-- Public users: no access (default, no policy needed)

-- ============================================
-- 5. RLS POLICIES FOR AUTOMATION_LOGS TABLE
-- ============================================

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Admins can select automation logs" ON automation_logs;
DROP POLICY IF EXISTS "Authenticated users can select own automation logs" ON automation_logs;

-- Admin users can: select
CREATE POLICY "Admins can select automation logs"
  ON automation_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Authenticated users can: select entries where automation belongs to them
-- (Placeholder for future owner_id - for now, users can see logs for automations they can view)
CREATE POLICY "Authenticated users can select own automation logs"
  ON automation_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM automations
      WHERE automations.id = automation_logs.automation_id
    )
  );

-- Public users: no access (default, no policy needed)

-- ============================================
-- 6. TRIGGER FOR UPDATED_AT
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_automations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS update_automations_updated_at ON automations;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_automations_updated_at
  BEFORE UPDATE ON automations
  FOR EACH ROW
  EXECUTE FUNCTION update_automations_updated_at();

-- ============================================
-- 7. TABLE COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE automations IS 'Stores automation workflow definitions';
COMMENT ON TABLE automation_logs IS 'Stores execution logs for automations';
COMMENT ON COLUMN automations.trigger IS 'JSON object defining when the automation should run (schedule, record_created, record_updated, field_match, date_approaching, manual)';
COMMENT ON COLUMN automations.conditions IS 'JSON array of conditions that must be met before actions execute';
COMMENT ON COLUMN automations.actions IS 'JSON array of actions to execute when trigger fires and conditions pass';
