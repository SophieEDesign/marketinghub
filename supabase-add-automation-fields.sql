-- ============================================
-- ADD AUTOMATION FIELDS TO TABLES
-- Run this in Supabase SQL Editor
-- ============================================

-- Add auto_tags column to content table (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content' AND column_name = 'auto_tags'
  ) THEN
    ALTER TABLE content ADD COLUMN auto_tags TEXT[];
  END IF;
END $$;

-- Add needs_attention column to content table (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content' AND column_name = 'needs_attention'
  ) THEN
    ALTER TABLE content ADD COLUMN needs_attention BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add linked_content_id column to ideas table (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ideas' AND column_name = 'linked_content_id'
  ) THEN
    ALTER TABLE ideas ADD COLUMN linked_content_id UUID REFERENCES content(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_auto_tags ON content USING GIN(auto_tags);
CREATE INDEX IF NOT EXISTS idx_content_needs_attention ON content(needs_attention);
CREATE INDEX IF NOT EXISTS idx_ideas_linked_content_id ON ideas(linked_content_id);

-- ============================================
-- VERIFY
-- ============================================
-- Run: SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'content' AND column_name IN ('auto_tags', 'needs_attention');
-- Run: SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ideas' AND column_name = 'linked_content_id';

