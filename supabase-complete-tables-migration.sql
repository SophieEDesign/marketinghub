-- ============================================
-- COMPLETE MARKETING HUB TABLES MIGRATION
-- Run this in Supabase SQL Editor
-- Creates all 10 tables with proper schema
-- ============================================

-- 1. CONTENT TABLE (if not exists)
CREATE TABLE IF NOT EXISTS content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT,
  content_type TEXT,
  channels TEXT[] DEFAULT '{}',
  publish_date DATE,
  assigned_to UUID,
  campaign_id UUID,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CAMPAIGNS TABLE
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

-- 3. CONTACTS TABLE
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

-- 4. IDEAS TABLE
CREATE TABLE IF NOT EXISTS ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. MEDIA TABLE
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

-- 6. TASKS TABLE
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

-- 7. BRIEFINGS TABLE
CREATE TABLE IF NOT EXISTS briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  notes TEXT,
  content_id UUID REFERENCES content(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. SPONSORSHIPS TABLE
CREATE TABLE IF NOT EXISTS sponsorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  notes TEXT,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. STRATEGY TABLE
CREATE TABLE IF NOT EXISTS strategy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  details TEXT,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. ASSETS TABLE
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT,
  file_url TEXT,
  asset_type TEXT,
  content_id UUID REFERENCES content(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Content indexes
CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
CREATE INDEX IF NOT EXISTS idx_content_publish_date ON content(publish_date);
CREATE INDEX IF NOT EXISTS idx_content_campaign_id ON content(campaign_id);
CREATE INDEX IF NOT EXISTS idx_content_created_at ON content(created_at);

-- Campaigns indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_start_date ON campaigns(start_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_end_date ON campaigns(end_date);

-- Contacts indexes
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);

-- Ideas indexes
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_category ON ideas(category);

-- Media indexes
CREATE INDEX IF NOT EXISTS idx_media_content_id ON media(content_id);
CREATE INDEX IF NOT EXISTS idx_media_date ON media(date);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_content_id ON tasks(content_id);
CREATE INDEX IF NOT EXISTS idx_tasks_campaign_id ON tasks(campaign_id);

-- Briefings indexes
CREATE INDEX IF NOT EXISTS idx_briefings_content_id ON briefings(content_id);

-- Sponsorships indexes
CREATE INDEX IF NOT EXISTS idx_sponsorships_start_date ON sponsorships(start_date);
CREATE INDEX IF NOT EXISTS idx_sponsorships_end_date ON sponsorships(end_date);

-- Strategy indexes
CREATE INDEX IF NOT EXISTS idx_strategy_category ON strategy(category);

-- Assets indexes
CREATE INDEX IF NOT EXISTS idx_assets_content_id ON assets(content_id);
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON assets(asset_type);

-- ============================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - Allow public read/write
-- ============================================

-- Content policies
DROP POLICY IF EXISTS "Allow public read access to content" ON content;
CREATE POLICY "Allow public read access to content" ON content FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access to content" ON content;
CREATE POLICY "Allow public write access to content" ON content FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to content" ON content;
CREATE POLICY "Allow public update access to content" ON content FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete access to content" ON content;
CREATE POLICY "Allow public delete access to content" ON content FOR DELETE USING (true);

-- Campaigns policies
DROP POLICY IF EXISTS "Allow public read access to campaigns" ON campaigns;
CREATE POLICY "Allow public read access to campaigns" ON campaigns FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access to campaigns" ON campaigns;
CREATE POLICY "Allow public write access to campaigns" ON campaigns FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to campaigns" ON campaigns;
CREATE POLICY "Allow public update access to campaigns" ON campaigns FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete access to campaigns" ON campaigns;
CREATE POLICY "Allow public delete access to campaigns" ON campaigns FOR DELETE USING (true);

-- Contacts policies
DROP POLICY IF EXISTS "Allow public read access to contacts" ON contacts;
CREATE POLICY "Allow public read access to contacts" ON contacts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access to contacts" ON contacts;
CREATE POLICY "Allow public write access to contacts" ON contacts FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to contacts" ON contacts;
CREATE POLICY "Allow public update access to contacts" ON contacts FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete access to contacts" ON contacts;
CREATE POLICY "Allow public delete access to contacts" ON contacts FOR DELETE USING (true);

-- Ideas policies
DROP POLICY IF EXISTS "Allow public read access to ideas" ON ideas;
CREATE POLICY "Allow public read access to ideas" ON ideas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access to ideas" ON ideas;
CREATE POLICY "Allow public write access to ideas" ON ideas FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to ideas" ON ideas;
CREATE POLICY "Allow public update access to ideas" ON ideas FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete access to ideas" ON ideas;
CREATE POLICY "Allow public delete access to ideas" ON ideas FOR DELETE USING (true);

-- Media policies
DROP POLICY IF EXISTS "Allow public read access to media" ON media;
CREATE POLICY "Allow public read access to media" ON media FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access to media" ON media;
CREATE POLICY "Allow public write access to media" ON media FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to media" ON media;
CREATE POLICY "Allow public update access to media" ON media FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete access to media" ON media;
CREATE POLICY "Allow public delete access to media" ON media FOR DELETE USING (true);

-- Tasks policies
DROP POLICY IF EXISTS "Allow public read access to tasks" ON tasks;
CREATE POLICY "Allow public read access to tasks" ON tasks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access to tasks" ON tasks;
CREATE POLICY "Allow public write access to tasks" ON tasks FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to tasks" ON tasks;
CREATE POLICY "Allow public update access to tasks" ON tasks FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete access to tasks" ON tasks;
CREATE POLICY "Allow public delete access to tasks" ON tasks FOR DELETE USING (true);

-- Briefings policies
DROP POLICY IF EXISTS "Allow public read access to briefings" ON briefings;
CREATE POLICY "Allow public read access to briefings" ON briefings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access to briefings" ON briefings;
CREATE POLICY "Allow public write access to briefings" ON briefings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to briefings" ON briefings;
CREATE POLICY "Allow public update access to briefings" ON briefings FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete access to briefings" ON briefings;
CREATE POLICY "Allow public delete access to briefings" ON briefings FOR DELETE USING (true);

-- Sponsorships policies
DROP POLICY IF EXISTS "Allow public read access to sponsorships" ON sponsorships;
CREATE POLICY "Allow public read access to sponsorships" ON sponsorships FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access to sponsorships" ON sponsorships;
CREATE POLICY "Allow public write access to sponsorships" ON sponsorships FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to sponsorships" ON sponsorships;
CREATE POLICY "Allow public update access to sponsorships" ON sponsorships FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete access to sponsorships" ON sponsorships;
CREATE POLICY "Allow public delete access to sponsorships" ON sponsorships FOR DELETE USING (true);

-- Strategy policies
DROP POLICY IF EXISTS "Allow public read access to strategy" ON strategy;
CREATE POLICY "Allow public read access to strategy" ON strategy FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access to strategy" ON strategy;
CREATE POLICY "Allow public write access to strategy" ON strategy FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to strategy" ON strategy;
CREATE POLICY "Allow public update access to strategy" ON strategy FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete access to strategy" ON strategy;
CREATE POLICY "Allow public delete access to strategy" ON strategy FOR DELETE USING (true);

-- Assets policies
DROP POLICY IF EXISTS "Allow public read access to assets" ON assets;
CREATE POLICY "Allow public read access to assets" ON assets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access to assets" ON assets;
CREATE POLICY "Allow public write access to assets" ON assets FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to assets" ON assets;
CREATE POLICY "Allow public update access to assets" ON assets FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete access to assets" ON assets;
CREATE POLICY "Allow public delete access to assets" ON assets FOR DELETE USING (true);

-- ============================================
-- CREATE UPDATED_AT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables
DROP TRIGGER IF EXISTS update_content_updated_at ON content;
CREATE TRIGGER update_content_updated_at BEFORE UPDATE ON content FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ideas_updated_at ON ideas;
CREATE TRIGGER update_ideas_updated_at BEFORE UPDATE ON ideas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_media_updated_at ON media;
CREATE TRIGGER update_media_updated_at BEFORE UPDATE ON media FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_briefings_updated_at ON briefings;
CREATE TRIGGER update_briefings_updated_at BEFORE UPDATE ON briefings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sponsorships_updated_at ON sponsorships;
CREATE TRIGGER update_sponsorships_updated_at BEFORE UPDATE ON sponsorships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_strategy_updated_at ON strategy;
CREATE TRIGGER update_strategy_updated_at BEFORE UPDATE ON strategy FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- All 10 tables created with:
-- - Proper schema matching tableMetadata.ts
-- - Foreign key relationships
-- - Indexes for performance
-- - RLS policies for security
-- - Auto-updating updated_at timestamps
-- ============================================

