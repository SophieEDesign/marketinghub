-- ============================================
-- SUPABASE SETUP SQL - Based on Your Actual Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create Settings Table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- 2. Add thumbnail_url column to content table (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content' AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE content ADD COLUMN thumbnail_url TEXT;
  END IF;
END $$;

-- 3. Add attachments column to content table (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content' AND column_name = 'attachments'
  ) THEN
    ALTER TABLE content ADD COLUMN attachments TEXT[];
  END IF;
END $$;

-- 4. Insert Initial Settings (this is what makes colors and settings work!)
INSERT INTO settings (key, value)
VALUES (
  'app_settings',
  '{
    "logo_url": null,
    "status_colors": {
      "draft": "#9ca3af",
      "To Do": "#9ca3af",
      "Awaiting Information": "#9ca3af",
      "In Progress": "#60a5fa",
      "Needs Update": "#fbbf24",
      "Drafted – Needs Internal Review": "#fbbf24",
      "Sent for Approval – Internal (P&M)": "#fbbf24",
      "Tech Check Required": "#fbbf24",
      "Text Approved – Image Needed": "#fbbf24",
      "Approved – Ready to Schedule": "#4ade80",
      "Scheduled": "#4ade80",
      "Completed (Published)": "#a78bfa",
      "Event Passed / Out of Date": "#6b7280",
      "Monthly (Recurring)": "#a78bfa",
      "Ideas": "#9ca3af",
      "Dates for Engagement": "#9ca3af",
      "Date Confirmed": "#9ca3af",
      "On Hold": "#6b7280",
      "Duplicate": "#6b7280",
      "Cancelled": "#6b7280"
    },
    "channel_colors": {
      "linkedin": "#0077b5",
      "facebook": "#1877f2",
      "instagram": "#e4405f",
      "x": "#000000",
      "twitter": "#000000",
      "website": "#06b6d4",
      "blog": "#8b5cf6",
      "email": "#f97316",
      "youtube": "#ff0000",
      "tiktok": "#000000",
      "pr": "#10b981",
      "internal": "#b45309"
    },
    "branding_colors": {
      "primary": "#2563eb",
      "secondary": "#64748b",
      "accent": "#f59e0b"
    },
    "custom_fields": [],
    "view_configs": {}
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- 5. Enable Row Level Security (RLS) if not already enabled
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies for settings table
DROP POLICY IF EXISTS "Allow public read access to settings" ON settings;
CREATE POLICY "Allow public read access to settings" ON settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access to settings" ON settings;
CREATE POLICY "Allow public write access to settings" ON settings
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to settings" ON settings;
CREATE POLICY "Allow public update access to settings" ON settings
  FOR UPDATE USING (true);

-- 7. Create RLS Policies for content table (if they don't exist)
DO $$ 
BEGIN
  -- Check and create SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'content' AND policyname = 'Allow public read access to content'
  ) THEN
    CREATE POLICY "Allow public read access to content" ON content
      FOR SELECT USING (true);
  END IF;

  -- Check and create INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'content' AND policyname = 'Allow public insert access to content'
  ) THEN
    CREATE POLICY "Allow public insert access to content" ON content
      FOR INSERT WITH CHECK (true);
  END IF;

  -- Check and create UPDATE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'content' AND policyname = 'Allow public update access to content'
  ) THEN
    CREATE POLICY "Allow public update access to content" ON content
      FOR UPDATE USING (true);
  END IF;

  -- Check and create DELETE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'content' AND policyname = 'Allow public delete access to content'
  ) THEN
    CREATE POLICY "Allow public delete access to content" ON content
      FOR DELETE USING (true);
  END IF;
END $$;

-- ============================================
-- VERIFY SETUP
-- ============================================
-- After running, check:
-- 1. Table Editor → settings table exists with key = 'app_settings'
-- 2. Table Editor → content table has thumbnail_url and attachments columns
-- 3. Storage → buckets: attachments, branding (both Public)
-- ============================================

