-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tables: Core data storage
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  access_control TEXT DEFAULT 'authenticated' CHECK (access_control IN ('public', 'authenticated', 'role-based', 'owner'))
);

-- Views: Different ways to display table data
CREATE TABLE IF NOT EXISTS views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('grid', 'form', 'kanban', 'calendar', 'gallery')),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- View Fields: Which fields are visible in a view and their order
CREATE TABLE IF NOT EXISTS view_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  view_id UUID NOT NULL REFERENCES views(id) ON DELETE CASCADE,
  field_id UUID NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- View Filters: Filtering rules for views
CREATE TABLE IF NOT EXISTS view_filters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  view_id UUID NOT NULL REFERENCES views(id) ON DELETE CASCADE,
  field_id UUID NOT NULL,
  filter_type TEXT NOT NULL CHECK (filter_type IN (
    'equal', 'not_equal', 'contains', 'not_contains', 'is_empty', 'is_not_empty',
    'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal',
    'date_equal', 'date_before', 'date_after', 'date_on_or_before', 'date_on_or_after'
  )),
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- View Sorts: Sorting configuration for views
CREATE TABLE IF NOT EXISTS view_sorts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  view_id UUID NOT NULL REFERENCES views(id) ON DELETE CASCADE,
  field_id UUID NOT NULL,
  order_direction TEXT NOT NULL CHECK (order_direction IN ('asc', 'desc')) DEFAULT 'asc',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- View Blocks: Blocks that can be added to interface pages
CREATE TABLE IF NOT EXISTS view_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  view_id UUID NOT NULL REFERENCES views(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'text', 'image', 'chart', 'kpi', 'html', 'embed', 'table', 'automation'
  )),
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 4,
  height INTEGER NOT NULL DEFAULT 4,
  config JSONB DEFAULT '{}',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automations: Automation workflows
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  actions JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Row data: Dynamic table rows stored as JSONB
CREATE TABLE IF NOT EXISTS table_rows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_views_table_id ON views(table_id);
CREATE INDEX IF NOT EXISTS idx_view_fields_view_id ON view_fields(view_id);
CREATE INDEX IF NOT EXISTS idx_view_filters_view_id ON view_filters(view_id);
CREATE INDEX IF NOT EXISTS idx_view_sorts_view_id ON view_sorts(view_id);
CREATE INDEX IF NOT EXISTS idx_view_blocks_view_id ON view_blocks(view_id);
CREATE INDEX IF NOT EXISTS idx_automations_table_id ON automations(table_id);
CREATE INDEX IF NOT EXISTS idx_table_rows_table_id ON table_rows(table_id);
CREATE INDEX IF NOT EXISTS idx_table_rows_data ON table_rows USING GIN(data);

-- Row Level Security (RLS) Policies
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE views ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_sorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_rows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tables
CREATE POLICY "Public tables are viewable by everyone"
  ON tables FOR SELECT
  USING (access_control = 'public');

CREATE POLICY "Authenticated users can view authenticated tables"
  ON tables FOR SELECT
  USING (access_control = 'authenticated' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view their own tables"
  ON tables FOR SELECT
  USING (access_control = 'owner' AND created_by = auth.uid());

CREATE POLICY "Authenticated users can create tables"
  ON tables FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own tables"
  ON tables FOR UPDATE
  USING (created_by = auth.uid());

-- RLS Policies for views
CREATE POLICY "Views are viewable with their tables"
  ON views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tables
      WHERE tables.id = views.table_id
      AND (
        tables.access_control = 'public'
        OR (tables.access_control = 'authenticated' AND auth.role() = 'authenticated')
        OR (tables.access_control = 'owner' AND tables.created_by = auth.uid())
      )
    )
  );

-- RLS Policies for table_rows
CREATE POLICY "Rows are viewable with their tables"
  ON table_rows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tables
      WHERE tables.id = table_rows.table_id
      AND (
        tables.access_control = 'public'
        OR (tables.access_control = 'authenticated' AND auth.role() = 'authenticated')
        OR (tables.access_control = 'owner' AND tables.created_by = auth.uid())
      )
    )
  );

CREATE POLICY "Authenticated users can insert rows"
  ON table_rows FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM tables
      WHERE tables.id = table_rows.table_id
      AND (
        tables.access_control = 'public'
        OR tables.access_control = 'authenticated'
        OR (tables.access_control = 'owner' AND tables.created_by = auth.uid())
      )
    )
  );

CREATE POLICY "Users can update rows in their tables"
  ON table_rows FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tables
      WHERE tables.id = table_rows.table_id
      AND tables.created_by = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_views_updated_at BEFORE UPDATE ON views
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_view_blocks_updated_at BEFORE UPDATE ON view_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automations_updated_at BEFORE UPDATE ON automations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_table_rows_updated_at BEFORE UPDATE ON table_rows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
