# ⚡ Quick Fix: Pages Table 404 Error

## Problem
The `pages` table doesn't exist in your Supabase database, causing 404 errors.

## Solution: Run Migration

### Option 1: Run Just the Pages Table (Quick Fix)

Run this in Supabase SQL Editor:

```sql
-- Create pages table if it doesn't exist
CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  layout TEXT DEFAULT 'custom',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pages_created_at ON pages(created_at);

-- Create page_blocks table if it doesn't exist
CREATE TABLE IF NOT EXISTS page_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 12,
  height INTEGER DEFAULT 6,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_blocks_page_id ON page_blocks(page_id);
CREATE INDEX IF NOT EXISTS idx_page_blocks_position ON page_blocks(page_id, position_y, position_x);

-- Enable RLS
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all pages" ON pages FOR SELECT USING (true);
CREATE POLICY "Users can create pages" ON pages FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update pages" ON pages FOR UPDATE USING (true);
CREATE POLICY "Users can delete pages" ON pages FOR DELETE USING (true);

CREATE POLICY "Users can view all page_blocks" ON page_blocks FOR SELECT USING (true);
CREATE POLICY "Users can create page_blocks" ON page_blocks FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update page_blocks" ON page_blocks FOR UPDATE USING (true);
CREATE POLICY "Users can delete page_blocks" ON page_blocks FOR DELETE USING (true);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pages_updated_at
  BEFORE UPDATE ON pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_page_blocks_updated_at
  BEFORE UPDATE ON page_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Option 2: Run Full Dynamic System Migration

For the complete rebuild, run the entire `supabase-dynamic-system-migration.sql` file.

## After Running

1. ✅ Refresh your app
2. ✅ The 404 errors for `/rest/v1/pages` should be gone
3. ✅ You can now create and view pages

## Note on Other Errors

The hardcoded column errors (like `content.briefings`, `ideas.updated_at`) will persist until the full dynamic system rebuild is complete. These are expected and will be fixed as we continue the rebuild.

