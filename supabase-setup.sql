-- ============================================
-- SUPABASE SETUP SQL
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create Settings Table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- 2. Create Content Table
CREATE TABLE IF NOT EXISTS content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT,
  channels TEXT[] DEFAULT '{}',
  publish_date DATE,
  content_type TEXT,
  thumbnail_url TEXT,
  campaigns UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for content table
CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
CREATE INDEX IF NOT EXISTS idx_content_publish_date ON content(publish_date);
CREATE INDEX IF NOT EXISTS idx_content_created_at ON content(created_at);

-- 3. Insert Initial Settings
INSERT INTO settings (key, value)
VALUES (
  'app_settings',
  '{
    "logo_url": null,
    "status_colors": {
      "draft": "#9ca3af",
      "in-progress": "#60a5fa",
      "review": "#fbbf24",
      "approved": "#4ade80",
      "published": "#a78bfa",
      "archived": "#6b7280"
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

-- 4. Enable Row Level Security (RLS) - Optional but recommended
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public read/write (adjust based on your security needs)
CREATE POLICY "Allow public read access to settings" ON settings
  FOR SELECT USING (true);

CREATE POLICY "Allow public write access to settings" ON settings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to settings" ON settings
  FOR UPDATE USING (true);

CREATE POLICY "Allow public read access to content" ON content
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to content" ON content
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to content" ON content
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access to content" ON content
  FOR DELETE USING (true);

-- ============================================
-- STORAGE SETUP (Do this in Supabase Dashboard)
-- ============================================
-- 1. Go to Storage → Create bucket: "attachments" (Public)
-- 2. Go to Storage → Create bucket: "branding" (Public)
-- ============================================

