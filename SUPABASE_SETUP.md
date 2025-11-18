# Supabase Setup Guide

## Step 1: Create Storage Buckets

### Bucket 1: `attachments`
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Storage** in the left sidebar
4. Click **"New bucket"**
5. Configure:
   - **Name**: `attachments`
   - **Public bucket**: ✅ **Enable** (check this box)
   - Click **"Create bucket"**

### Bucket 2: `branding`
1. Still in Storage, click **"New bucket"** again
2. Configure:
   - **Name**: `branding`
   - **Public bucket**: ✅ **Enable** (check this box)
   - Click **"Create bucket"**

## Step 2: Create Settings Table

1. In Supabase Dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Paste this SQL:

```sql
-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- Insert initial branding settings (optional)
INSERT INTO settings (key, value)
VALUES (
  'branding',
  '{"logo_url": null, "status_colors": {}, "channel_colors": {}, "branding_colors": {"primary": "#2563eb", "secondary": "#64748b", "accent": "#f59e0b"}}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Insert app settings (optional)
INSERT INTO settings (key, value)
VALUES (
  'app_settings',
  '{"logo_url": null, "status_colors": {"draft": "#9ca3af", "in-progress": "#60a5fa", "review": "#fbbf24", "approved": "#4ade80", "published": "#a78bfa", "archived": "#6b7280"}, "channel_colors": {"linkedin": "#0077b5", "facebook": "#1877f2", "instagram": "#e4405f", "x": "#000000", "twitter": "#000000", "website": "#06b6d4", "blog": "#8b5cf6", "email": "#f97316", "youtube": "#ff0000", "tiktok": "#000000", "pr": "#10b981", "internal": "#b45309"}, "branding_colors": {"primary": "#2563eb", "secondary": "#64748b", "accent": "#f59e0b"}}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
```

4. Click **"Run"** (or press Ctrl+Enter)
5. You should see "Success. No rows returned"

## Step 3: Verify Setup

### Check Storage Buckets
1. Go to **Storage** → You should see both `attachments` and `branding` buckets
2. Both should show as **Public**

### Check Settings Table
1. Go to **Table Editor** → Find `settings` table
2. You should see at least one row with `key = 'branding'` or `key = 'app_settings'`

## Step 4: Set Storage Policies (Optional but Recommended)

For the `attachments` bucket:
1. Go to **Storage** → `attachments` → **Policies**
2. Click **"New Policy"**
3. Select **"For full customization"**
4. Policy name: `Allow public uploads`
5. Allowed operation: `INSERT`
6. Policy definition:
```sql
true
```
7. Click **"Review"** → **"Save policy"**

Repeat for `SELECT` operation (to allow downloads).

For the `branding` bucket:
- Same process, but you can make it simpler since it's just for logos

## That's It!

Your Supabase is now configured. Your app should be able to:
- ✅ Upload files to storage
- ✅ Store and retrieve settings
- ✅ Display logos
- ✅ Save custom field configurations

## Troubleshooting

**If uploads fail:**
- Check bucket is set to Public
- Verify RLS policies allow INSERT operations
- Check browser console for specific error messages

**If settings don't save:**
- Verify the `settings` table exists
- Check that the `key` column is TEXT and PRIMARY KEY
- Ensure `value` column is JSONB type

