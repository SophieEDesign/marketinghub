# Vercel & Supabase Setup Checklist

## ✅ Step 1: Verify Vercel Environment Variables

Go to your Vercel project dashboard:
1. **Settings** → **Environment Variables**
2. Verify these are set (for Production, Preview, and Development):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://hwtycgvclhckglmuwnmw.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3dHljZ3ZjbGhja2dsbXV3bm13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Mzg0OTIsImV4cCI6MjA3OTAxNDQ5Mn0.-yOyserJWJgp0WByBxlOBpksNOGdRJTJ-fUiS6lS-H8`
3. **Redeploy** after adding/updating variables

## ✅ Step 2: Create Supabase Tables

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **"New query"**
3. Copy and paste the contents of `supabase-setup.sql` (or see below)
4. Click **"Run"** (or press Ctrl+Enter)
5. You should see "Success. No rows returned"

### Quick SQL (or use supabase-setup.sql file):

```sql
-- Create Settings Table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Content Table
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

-- Insert Initial Settings
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

-- Enable RLS and create policies
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

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
```

## ✅ Step 3: Create Storage Buckets

1. Go to **Supabase Dashboard** → **Storage**
2. Click **"New bucket"**
3. Create bucket: **`attachments`**
   - Name: `attachments`
   - **Public bucket**: ✅ Enable
   - Click **"Create bucket"**
4. Click **"New bucket"** again
5. Create bucket: **`branding`**
   - Name: `branding`
   - **Public bucket**: ✅ Enable
   - Click **"Create bucket"**

## ✅ Step 4: Verify Setup

### Check Tables:
1. Go to **Table Editor**
2. You should see:
   - ✅ `settings` table (with at least 1 row: `key = 'app_settings'`)
   - ✅ `content` table (can be empty)

### Check Storage:
1. Go to **Storage**
2. You should see:
   - ✅ `attachments` bucket (Public)
   - ✅ `branding` bucket (Public)

### Test the App:
1. Visit your Vercel deployment URL
2. Try to:
   - ✅ See default colors (status chips should have colors)
   - ✅ Create new content (click "+ New" button)
   - ✅ View content in Grid/Kanban/Calendar views
   - ✅ Open Settings (should load without errors)

## 🔧 Troubleshooting

**If colors don't show:**
- Check `settings` table exists and has `key = 'app_settings'`
- Check browser console for errors
- Verify environment variables are set in Vercel

**If content doesn't save:**
- Check `content` table exists
- Check RLS policies are created (see SQL above)
- Check browser console for specific errors

**If uploads fail:**
- Verify storage buckets exist and are Public
- Check browser console for errors

**If settings don't load:**
- Verify `settings` table exists
- Check the `app_settings` row exists
- Verify environment variables in Vercel

