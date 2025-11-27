-- Automations System Database Schema
-- This migration creates/updates the automations and automation_logs tables with proper RLS policies
-- Matches existing automations table structure exactly

-- Create automations table if it doesn't exist (matches your exact schema)
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT ''::text,
  trigger JSONB NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add conditions column if missing (for automation conditions support)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'automations' AND column_name = 'conditions'
  ) THEN
    ALTER TABLE automations ADD COLUMN conditions JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Create automation_logs table
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES automations(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  status TEXT CHECK (status IN ('success', 'error')) NOT NULL,
  input JSONB,
  output JSONB,
  error TEXT,
  duration_ms INTEGER
);

-- Add status column to automation_logs if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'automation_logs' AND column_name = 'status'
  ) THEN
    ALTER TABLE automation_logs ADD COLUMN status TEXT CHECK (status IN ('success', 'error')) NOT NULL DEFAULT 'success';
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations(enabled);
CREATE INDEX IF NOT EXISTS idx_automations_created_at ON automations(created_at);
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_timestamp ON automation_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(status);

-- Enable Row Level Security
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Authenticated users can view automations" ON automations;
DROP POLICY IF EXISTS "Admins can create automations" ON automations;
DROP POLICY IF EXISTS "Admins can update automations" ON automations;
DROP POLICY IF EXISTS "Admins can delete automations" ON automations;
DROP POLICY IF EXISTS "Authenticated users can view automation logs" ON automation_logs;
DROP POLICY IF EXISTS "Authenticated users can insert automation logs" ON automation_logs;

-- RLS Policies for automations table
-- Authenticated users can view automations
CREATE POLICY "Authenticated users can view automations"
  ON automations
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admin roles can create/update/delete automations
-- Note: Adjust this policy based on your actual role system
CREATE POLICY "Admins can create automations"
  ON automations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      -- Add your admin check here, e.g., check user metadata or separate roles table
      -- For now, allowing all authenticated users to create
      -- You can add: AND (auth.users.raw_user_meta_data->>'role' = 'admin')
    )
  );

CREATE POLICY "Admins can update automations"
  ON automations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      -- Add your admin check here
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      -- Add your admin check here
    )
  );

CREATE POLICY "Admins can delete automations"
  ON automations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      -- Add your admin check here
    )
  );

-- RLS Policies for automation_logs table
-- Authenticated users can view logs for automations they can view
CREATE POLICY "Authenticated users can view automation logs"
  ON automation_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM automations
      WHERE automations.id = automation_logs.automation_id
    )
  );

-- Only system can insert logs (via service role)
-- For now, allowing authenticated users to insert logs
CREATE POLICY "Authenticated users can insert automation logs"
  ON automation_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

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

-- Add comments for documentation
COMMENT ON TABLE automations IS 'Stores automation workflow definitions';
COMMENT ON TABLE automation_logs IS 'Stores execution logs for automations';
COMMENT ON COLUMN automations.trigger IS 'JSON object defining when the automation should run';
COMMENT ON COLUMN automations.conditions IS 'JSON array of conditions that must be met';
COMMENT ON COLUMN automations.actions IS 'JSON array of actions to execute';

