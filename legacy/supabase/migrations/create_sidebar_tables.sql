-- Create sidebar_categories table
CREATE TABLE IF NOT EXISTS sidebar_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sidebar_items table
CREATE TABLE IF NOT EXISTS sidebar_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES sidebar_categories(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('table', 'view', 'dashboard', 'link')),
  item_id TEXT NOT NULL,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  icon TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sidebar_categories_position ON sidebar_categories(position);
CREATE INDEX IF NOT EXISTS idx_sidebar_items_category_id ON sidebar_items(category_id);
CREATE INDEX IF NOT EXISTS idx_sidebar_items_position ON sidebar_items(position);
CREATE INDEX IF NOT EXISTS idx_sidebar_items_item_type ON sidebar_items(item_type);
CREATE INDEX IF NOT EXISTS idx_sidebar_items_item_id ON sidebar_items(item_id);

-- Enable RLS
ALTER TABLE sidebar_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sidebar_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sidebar_categories
CREATE POLICY "Allow authenticated users to read sidebar categories"
  ON sidebar_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert sidebar categories"
  ON sidebar_categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update sidebar categories"
  ON sidebar_categories FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to delete sidebar categories"
  ON sidebar_categories FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for sidebar_items
CREATE POLICY "Allow authenticated users to read sidebar items"
  ON sidebar_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert sidebar items"
  ON sidebar_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update sidebar items"
  ON sidebar_items FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to delete sidebar items"
  ON sidebar_items FOR DELETE
  TO authenticated
  USING (true);
