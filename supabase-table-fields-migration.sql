-- ============================================
-- TABLE FIELDS MIGRATION
-- Run this in Supabase SQL Editor
-- ============================================

-- Create table_fields table for field metadata
CREATE TABLE IF NOT EXISTS table_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL,
  options JSONB,
  "order" INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT false,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(table_id, field_key)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_table_fields_table_id ON table_fields(table_id);
CREATE INDEX IF NOT EXISTS idx_table_fields_order ON table_fields(table_id, "order");

-- Enable RLS
ALTER TABLE table_fields ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow public read access to table_fields" ON table_fields;
CREATE POLICY "Allow public read access to table_fields" ON table_fields
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access to table_fields" ON table_fields;
CREATE POLICY "Allow public write access to table_fields" ON table_fields
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to table_fields" ON table_fields;
CREATE POLICY "Allow public update access to table_fields" ON table_fields
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete access to table_fields" ON table_fields;
CREATE POLICY "Allow public delete access to table_fields" ON table_fields
  FOR DELETE USING (true);

-- Insert default fields for content table
-- These match the existing content table structure
INSERT INTO table_fields (table_id, field_key, label, type, options, "order", required, visible)
VALUES
  ('content', 'id', 'ID', 'text', NULL, 0, true, false),
  ('content', 'title', 'Title', 'text', NULL, 1, true, true),
  ('content', 'description', 'Description', 'long_text', NULL, 2, false, true),
  ('content', 'status', 'Status', 'single_select', '[
    {"id": "todo", "label": "To Do"},
    {"id": "awaiting", "label": "Awaiting Information"},
    {"id": "in_progress", "label": "In Progress"},
    {"id": "needs_update", "label": "Needs Update"},
    {"id": "drafted", "label": "Drafted – Needs Internal Review"},
    {"id": "sent_approval", "label": "Sent for Approval – Internal (P&M)"},
    {"id": "tech_check", "label": "Tech Check Required"},
    {"id": "text_approved", "label": "Text Approved – Image Needed"},
    {"id": "approved", "label": "Approved – Ready to Schedule"},
    {"id": "scheduled", "label": "Scheduled"},
    {"id": "completed", "label": "Completed (Published)"},
    {"id": "event_passed", "label": "Event Passed / Out of Date"},
    {"id": "monthly", "label": "Monthly (Recurring)"},
    {"id": "ideas", "label": "Ideas"},
    {"id": "dates_engagement", "label": "Dates for Engagement"},
    {"id": "date_confirmed", "label": "Date Confirmed"},
    {"id": "on_hold", "label": "On Hold"},
    {"id": "duplicate", "label": "Duplicate"},
    {"id": "cancelled", "label": "Cancelled"}
  ]'::jsonb, 3, false, true),
  ('content', 'channels', 'Channels', 'multi_select', NULL, 4, false, true),
  ('content', 'content_type', 'Content Type', 'text', NULL, 5, false, true),
  ('content', 'publish_date', 'Publish Date', 'date', NULL, 6, false, true),
  ('content', 'thumbnail_url', 'Thumbnail', 'attachment', NULL, 7, false, true),
  ('content', 'campaign_id', 'Campaign', 'linked_record', NULL, 8, false, true),
  ('content', 'created_at', 'Created At', 'date', NULL, 9, false, false),
  ('content', 'updated_at', 'Updated At', 'date', NULL, 10, false, false)
ON CONFLICT (table_id, field_key) DO NOTHING;

-- ============================================
-- VERIFY SETUP
-- ============================================
-- After running, check:
-- 1. Table Editor → table_fields table exists
-- 2. Table Editor → table_fields has rows for content table
-- ============================================

