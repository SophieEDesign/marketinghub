-- Sidebar Categories System
-- Allows custom categories with pages and tables mixed together

-- Categories table
CREATE TABLE IF NOT EXISTS sidebar_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'folder', -- icon name from lucide-react
  position INTEGER DEFAULT 0, -- order in sidebar
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sidebar items table (links pages/tables to categories)
CREATE TABLE IF NOT EXISTS sidebar_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES sidebar_categories(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('page', 'table', 'link')), -- 'page', 'table', or 'link' for custom links
  item_id TEXT, -- page.id or table.id (or null for custom links)
  label TEXT NOT NULL, -- display name (can be customized)
  href TEXT NOT NULL, -- URL path
  icon TEXT, -- icon name from lucide-react
  position INTEGER DEFAULT 0, -- order within category
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sidebar_categories_position ON sidebar_categories(position);
CREATE INDEX IF NOT EXISTS idx_sidebar_items_category_id ON sidebar_items(category_id);
CREATE INDEX IF NOT EXISTS idx_sidebar_items_position ON sidebar_items(category_id, position);

-- Enable RLS
ALTER TABLE sidebar_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sidebar_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies - full access for all users
DROP POLICY IF EXISTS "Users can view all sidebar_categories" ON sidebar_categories;
DROP POLICY IF EXISTS "Users can create sidebar_categories" ON sidebar_categories;
DROP POLICY IF EXISTS "Users can update sidebar_categories" ON sidebar_categories;
DROP POLICY IF EXISTS "Users can delete sidebar_categories" ON sidebar_categories;

CREATE POLICY "Users can view all sidebar_categories" ON sidebar_categories FOR SELECT USING (true);
CREATE POLICY "Users can create sidebar_categories" ON sidebar_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update sidebar_categories" ON sidebar_categories FOR UPDATE USING (true);
CREATE POLICY "Users can delete sidebar_categories" ON sidebar_categories FOR DELETE USING (true);

DROP POLICY IF EXISTS "Users can view all sidebar_items" ON sidebar_items;
DROP POLICY IF EXISTS "Users can create sidebar_items" ON sidebar_items;
DROP POLICY IF EXISTS "Users can update sidebar_items" ON sidebar_items;
DROP POLICY IF EXISTS "Users can delete sidebar_items" ON sidebar_items;

CREATE POLICY "Users can view all sidebar_items" ON sidebar_items FOR SELECT USING (true);
CREATE POLICY "Users can create sidebar_items" ON sidebar_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update sidebar_items" ON sidebar_items FOR UPDATE USING (true);
CREATE POLICY "Users can delete sidebar_items" ON sidebar_items FOR DELETE USING (true);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_sidebar_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_sidebar_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sidebar_categories_updated_at ON sidebar_categories;
CREATE TRIGGER update_sidebar_categories_updated_at
  BEFORE UPDATE ON sidebar_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_sidebar_categories_updated_at();

DROP TRIGGER IF EXISTS update_sidebar_items_updated_at ON sidebar_items;
CREATE TRIGGER update_sidebar_items_updated_at
  BEFORE UPDATE ON sidebar_items
  FOR EACH ROW
  EXECUTE FUNCTION update_sidebar_items_updated_at();

-- Insert default categories if they don't exist
INSERT INTO sidebar_categories (id, name, icon, position)
SELECT 
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Main',
  'layout-dashboard',
  0
WHERE NOT EXISTS (
  SELECT 1 FROM sidebar_categories WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
);

INSERT INTO sidebar_categories (id, name, icon, position)
SELECT 
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Content',
  'file-text',
  1
WHERE NOT EXISTS (
  SELECT 1 FROM sidebar_categories WHERE id = '00000000-0000-0000-0000-000000000002'::uuid
);

INSERT INTO sidebar_categories (id, name, icon, position)
SELECT 
  '00000000-0000-0000-0000-000000000003'::uuid,
  'Tools',
  'settings',
  2
WHERE NOT EXISTS (
  SELECT 1 FROM sidebar_categories WHERE id = '00000000-0000-0000-0000-000000000003'::uuid
);

