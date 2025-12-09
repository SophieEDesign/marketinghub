-- ============================================
-- CREATE CONTENT TABLE
-- Run this in Supabase SQL Editor to create the physical table
-- ============================================

-- First, ensure the create_dynamic_table function exists
-- (Run supabase-create-table-function.sql first if you haven't)

-- Create the content table with standard structure
CREATE TABLE IF NOT EXISTS content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on created_at
CREATE INDEX IF NOT EXISTS idx_content_created_at ON content(created_at);

-- Enable RLS
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view all content" ON content;
CREATE POLICY "Users can view all content" ON content FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create content" ON content;
CREATE POLICY "Users can create content" ON content FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update content" ON content;
CREATE POLICY "Users can update content" ON content FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete content" ON content;
CREATE POLICY "Users can delete content" ON content FOR DELETE USING (true);

-- Create trigger for updated_at (if the function exists)
DROP TRIGGER IF EXISTS update_content_updated_at ON content;
CREATE TRIGGER update_content_updated_at
  BEFORE UPDATE ON content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ALTERNATIVE: Use the create_dynamic_table function if it exists
-- ============================================
-- SELECT create_dynamic_table('content', 'Content');
