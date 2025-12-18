-- Migration: Create pages and page_blocks tables for Interface Builder

-- Pages: Interface pages
CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{"access": "authenticated", "layout": {"cols": 12, "rowHeight": 30, "margin": [10, 10]}}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Page Blocks: Blocks on interface pages
CREATE TABLE IF NOT EXISTS page_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'grid', 'form', 'record', 'chart', 'kpi', 'text', 'image', 'divider', 'button', 'tabs'
  )),
  x INTEGER NOT NULL DEFAULT 0,
  y INTEGER NOT NULL DEFAULT 0,
  w INTEGER NOT NULL DEFAULT 4,
  h INTEGER NOT NULL DEFAULT 4,
  config JSONB DEFAULT '{}',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_page_blocks_page_id ON page_blocks(page_id);
CREATE INDEX IF NOT EXISTS idx_page_blocks_order_index ON page_blocks(page_id, order_index);

-- Update trigger for updated_at
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
