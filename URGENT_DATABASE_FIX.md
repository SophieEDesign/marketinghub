# 🚨 URGENT: Database Migration Required

## Current Issue
The dashboard is returning 500 errors because the required database tables don't exist in Supabase.

## Immediate Action Required

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**

### Step 2: Run This Migration

Copy and paste the **entire contents** of `supabase-dashboard-complete-migration.sql` into the SQL Editor and click **Run**.

**OR** copy this directly:

```sql
-- Create dashboards table
CREATE TABLE IF NOT EXISTS dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create dashboard_modules table
CREATE TABLE IF NOT EXISTS dashboard_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 4,
  height INTEGER NOT NULL DEFAULT 4,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_dashboard_modules_dashboard_id ON dashboard_modules(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_modules_position ON dashboard_modules(dashboard_id, position_y, position_x);

-- Enable RLS
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_modules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all dashboards" ON dashboards;
DROP POLICY IF EXISTS "Users can create dashboards" ON dashboards;
DROP POLICY IF EXISTS "Users can update dashboards" ON dashboards;
DROP POLICY IF EXISTS "Users can delete dashboards" ON dashboards;

DROP POLICY IF EXISTS "Users can view all dashboard modules" ON dashboard_modules;
DROP POLICY IF EXISTS "Users can create dashboard modules" ON dashboard_modules;
DROP POLICY IF EXISTS "Users can update dashboard modules" ON dashboard_modules;
DROP POLICY IF EXISTS "Users can delete dashboard modules" ON dashboard_modules;

-- Create RLS Policies for dashboards
CREATE POLICY "Users can view all dashboards" ON dashboards
  FOR SELECT USING (true);

CREATE POLICY "Users can create dashboards" ON dashboards
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update dashboards" ON dashboards
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete dashboards" ON dashboards
  FOR DELETE USING (true);

-- Create RLS Policies for dashboard_modules
CREATE POLICY "Users can view all dashboard modules" ON dashboard_modules
  FOR SELECT USING (true);

CREATE POLICY "Users can create dashboard modules" ON dashboard_modules
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update dashboard modules" ON dashboard_modules
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete dashboard modules" ON dashboard_modules
  FOR DELETE USING (true);

-- Create default dashboard
INSERT INTO dashboards (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Main Dashboard')
ON CONFLICT (id) DO NOTHING;
```

### Step 3: Verify
After running, you should see:
- ✅ Success message
- ✅ Tables created in the Table Editor
- ✅ Dashboard page loads without 500 errors

### Step 4: Refresh Your App
Refresh your browser - the dashboard should now work!

## What This Does
- Creates `dashboards` table
- Creates `dashboard_modules` table  
- Sets up proper indexes
- Enables Row Level Security (RLS)
- Creates public access policies
- Creates default dashboard

## Still Getting Errors?
Check the Supabase logs for the exact error message. The API routes now provide more detailed error information.

