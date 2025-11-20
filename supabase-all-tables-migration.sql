-- ============================================
-- CREATE ALL MARKETING HUB TABLES
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. CAMPAIGNS TABLE
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT,
  colour TEXT,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CONTACTS TABLE
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. IDEAS TABLE
CREATE TABLE IF NOT EXISTS ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. MEDIA TABLE
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication TEXT NOT NULL,
  url TEXT,
  date DATE,
  notes TEXT,
  content_id UUID REFERENCES content(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TASKS TABLE
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT,
  due_date DATE,
  assigned_to UUID REFERENCES contacts(id) ON DELETE SET NULL,
  content_id UUID REFERENCES content(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_start_date ON campaigns(start_date);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_category ON ideas(category);
CREATE INDEX IF NOT EXISTS idx_media_date ON media(date);
CREATE INDEX IF NOT EXISTS idx_media_content_id ON media(content_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_content_id ON tasks(content_id);
CREATE INDEX IF NOT EXISTS idx_tasks_campaign_id ON tasks(campaign_id);

-- Enable RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow public access for now - adjust as needed)
CREATE POLICY "Allow public read access to campaigns" ON campaigns FOR SELECT USING (true);
CREATE POLICY "Allow public write access to campaigns" ON campaigns FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to campaigns" ON campaigns FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to campaigns" ON campaigns FOR DELETE USING (true);

CREATE POLICY "Allow public read access to contacts" ON contacts FOR SELECT USING (true);
CREATE POLICY "Allow public write access to contacts" ON contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to contacts" ON contacts FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to contacts" ON contacts FOR DELETE USING (true);

CREATE POLICY "Allow public read access to ideas" ON ideas FOR SELECT USING (true);
CREATE POLICY "Allow public write access to ideas" ON ideas FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to ideas" ON ideas FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to ideas" ON ideas FOR DELETE USING (true);

CREATE POLICY "Allow public read access to media" ON media FOR SELECT USING (true);
CREATE POLICY "Allow public write access to media" ON media FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to media" ON media FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to media" ON media FOR DELETE USING (true);

CREATE POLICY "Allow public read access to tasks" ON tasks FOR SELECT USING (true);
CREATE POLICY "Allow public write access to tasks" ON tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to tasks" ON tasks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to tasks" ON tasks FOR DELETE USING (true);

-- ============================================
-- INSERT DEFAULT FIELDS FOR ALL TABLES
-- ============================================

-- Campaigns fields
INSERT INTO table_fields (table_id, field_key, label, type, options, "order", required, visible)
VALUES
  ('campaigns', 'id', 'ID', 'text', NULL, 0, true, false),
  ('campaigns', 'name', 'Name', 'text', NULL, 1, true, true),
  ('campaigns', 'description', 'Description', 'long_text', NULL, 2, false, true),
  ('campaigns', 'status', 'Status', 'single_select', '{"values": [{"id": "planning", "label": "Planning"}, {"id": "active", "label": "Active"}, {"id": "completed", "label": "Completed"}, {"id": "cancelled", "label": "Cancelled"}]}'::jsonb, 3, false, true),
  ('campaigns', 'colour', 'Colour', 'text', NULL, 4, false, true),
  ('campaigns', 'start_date', 'Start Date', 'date', NULL, 5, false, true),
  ('campaigns', 'end_date', 'End Date', 'date', NULL, 6, false, true),
  ('campaigns', 'created_at', 'Created At', 'date', NULL, 7, false, false),
  ('campaigns', 'updated_at', 'Updated At', 'date', NULL, 8, false, false)
ON CONFLICT (table_id, field_key) DO NOTHING;

-- Contacts fields
INSERT INTO table_fields (table_id, field_key, label, type, options, "order", required, visible)
VALUES
  ('contacts', 'id', 'ID', 'text', NULL, 0, true, false),
  ('contacts', 'name', 'Name', 'text', NULL, 1, true, true),
  ('contacts', 'email', 'Email', 'text', NULL, 2, false, true),
  ('contacts', 'phone', 'Phone', 'text', NULL, 3, false, true),
  ('contacts', 'company', 'Company', 'text', NULL, 4, false, true),
  ('contacts', 'notes', 'Notes', 'long_text', NULL, 5, false, true),
  ('contacts', 'created_at', 'Created At', 'date', NULL, 6, false, false),
  ('contacts', 'updated_at', 'Updated At', 'date', NULL, 7, false, false)
ON CONFLICT (table_id, field_key) DO NOTHING;

-- Ideas fields
INSERT INTO table_fields (table_id, field_key, label, type, options, "order", required, visible)
VALUES
  ('ideas', 'id', 'ID', 'text', NULL, 0, true, false),
  ('ideas', 'title', 'Title', 'text', NULL, 1, true, true),
  ('ideas', 'description', 'Description', 'long_text', NULL, 2, false, true),
  ('ideas', 'category', 'Category', 'single_select', '{"values": [{"id": "social", "label": "Social Media"}, {"id": "blog", "label": "Blog"}, {"id": "email", "label": "Email"}, {"id": "event", "label": "Event"}, {"id": "other", "label": "Other"}]}'::jsonb, 3, false, true),
  ('ideas', 'status', 'Status', 'single_select', '{"values": [{"id": "idea", "label": "Idea"}, {"id": "draft", "label": "Draft"}, {"id": "ready", "label": "Ready"}, {"id": "completed", "label": "Completed"}]}'::jsonb, 4, false, true),
  ('ideas', 'created_at', 'Created At', 'date', NULL, 5, false, false),
  ('ideas', 'updated_at', 'Updated At', 'date', NULL, 6, false, false)
ON CONFLICT (table_id, field_key) DO NOTHING;

-- Media fields
INSERT INTO table_fields (table_id, field_key, label, type, options, "order", required, visible)
VALUES
  ('media', 'id', 'ID', 'text', NULL, 0, true, false),
  ('media', 'publication', 'Publication', 'text', NULL, 1, true, true),
  ('media', 'url', 'URL', 'text', NULL, 2, false, true),
  ('media', 'date', 'Date', 'date', NULL, 3, false, true),
  ('media', 'notes', 'Notes', 'long_text', NULL, 4, false, true),
  ('media', 'content_id', 'Content', 'linked_record', NULL, 5, false, true),
  ('media', 'created_at', 'Created At', 'date', NULL, 6, false, false),
  ('media', 'updated_at', 'Updated At', 'date', NULL, 7, false, false)
ON CONFLICT (table_id, field_key) DO NOTHING;

-- Tasks fields
INSERT INTO table_fields (table_id, field_key, label, type, options, "order", required, visible)
VALUES
  ('tasks', 'id', 'ID', 'text', NULL, 0, true, false),
  ('tasks', 'title', 'Title', 'text', NULL, 1, true, true),
  ('tasks', 'description', 'Description', 'long_text', NULL, 2, false, true),
  ('tasks', 'status', 'Status', 'single_select', '{"values": [{"id": "todo", "label": "To Do"}, {"id": "in_progress", "label": "In Progress"}, {"id": "done", "label": "Done"}]}'::jsonb, 3, false, true),
  ('tasks', 'due_date', 'Due Date', 'date', NULL, 4, false, true),
  ('tasks', 'assigned_to', 'Assigned To', 'linked_record', NULL, 5, false, true),
  ('tasks', 'content_id', 'Content', 'linked_record', NULL, 6, false, true),
  ('tasks', 'campaign_id', 'Campaign', 'linked_record', NULL, 7, false, true),
  ('tasks', 'created_at', 'Created At', 'date', NULL, 8, false, false),
  ('tasks', 'updated_at', 'Updated At', 'date', NULL, 9, false, false)
ON CONFLICT (table_id, field_key) DO NOTHING;

-- ============================================
-- VERIFY SETUP
-- ============================================
-- Run these queries to verify:
-- SELECT * FROM campaigns LIMIT 1;
-- SELECT * FROM contacts LIMIT 1;
-- SELECT * FROM ideas LIMIT 1;
-- SELECT * FROM media LIMIT 1;
-- SELECT * FROM tasks LIMIT 1;
-- SELECT * FROM table_fields WHERE table_id IN ('campaigns', 'contacts', 'ideas', 'media', 'tasks') ORDER BY table_id, "order";

