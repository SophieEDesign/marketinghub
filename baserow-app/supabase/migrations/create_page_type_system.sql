-- Migration: Create Page Type System for Dynamic Interface Templates
-- This migration creates the infrastructure for dynamic, database-driven page types

-- 1. Add page_type column to views table (for interfaces)
ALTER TABLE views 
ADD COLUMN IF NOT EXISTS page_type TEXT;

-- Add index for page_type lookups
CREATE INDEX IF NOT EXISTS idx_views_page_type ON views(page_type) WHERE page_type IS NOT NULL;

-- 2. Create page_type_templates table
CREATE TABLE IF NOT EXISTS page_type_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT NOT NULL, -- 'browse_plan', 'create_review', 'insights', 'advanced', 'other'
  admin_only BOOLEAN DEFAULT FALSE,
  default_blocks JSONB DEFAULT '[]'::jsonb, -- Array of block definitions
  allowed_blocks JSONB DEFAULT '[]'::jsonb, -- Array of allowed block types (empty = all allowed)
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_page_type_templates_category ON page_type_templates(category);
CREATE INDEX IF NOT EXISTS idx_page_type_templates_order ON page_type_templates(category, order_index);

-- Update trigger for updated_at
CREATE TRIGGER update_page_type_templates_updated_at
  BEFORE UPDATE ON page_type_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE page_type_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for page_type_templates
-- Everyone can read templates (they're public metadata)
CREATE POLICY "Allow authenticated users to read page type templates"
  ON page_type_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify templates
CREATE POLICY "Allow admins to manage page type templates"
  ON page_type_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 3. Seed initial page type templates
-- Note: These are examples - the system is fully dynamic and templates can be modified via admin UI

INSERT INTO page_type_templates (type, label, description, icon, category, admin_only, order_index, default_blocks, allowed_blocks) VALUES
-- Browse & Plan category
('list', 'List', 'A simple grid view of your data', '📋', 'browse_plan', false, 0, 
 $$[
   {
     "type": "grid",
     "x": 0,
     "y": 0,
     "w": 12,
     "h": 8,
     "config": {"title": "Data Grid", "table_id": ""}
   }
 ]$$::jsonb,
 '[]'::jsonb),

('gallery', 'Gallery', 'Visual card-based view of records', '🖼️', 'browse_plan', false, 1,
 $$[
   {
     "type": "grid",
     "x": 0,
     "y": 0,
     "w": 12,
     "h": 10,
     "config": {"title": "Gallery View", "table_id": "", "view_type": "gallery"}
   }
 ]$$::jsonb,
 '[]'::jsonb),

('kanban', 'Kanban', 'Board view with drag-and-drop columns', '📊', 'browse_plan', false, 2,
 $$[
   {
     "type": "grid",
     "x": 0,
     "y": 0,
     "w": 12,
     "h": 10,
     "config": {"title": "Kanban Board", "table_id": "", "view_type": "kanban"}
   }
 ]$$::jsonb,
 '[]'::jsonb),

('calendar', 'Calendar', 'Month/week calendar view of date-based records', '📅', 'browse_plan', false, 3,
 $$[
   {
     "type": "grid",
     "x": 0,
     "y": 0,
     "w": 12,
     "h": 10,
     "config": {"title": "Calendar", "table_id": "", "view_type": "calendar"}
   }
 ]$$::jsonb,
 '[]'::jsonb),

('timeline', 'Timeline', 'Chronological timeline view of records', '⏱️', 'browse_plan', false, 4,
 $$[
   {
     "type": "grid",
     "x": 0,
     "y": 0,
     "w": 12,
     "h": 10,
     "config": {"title": "Timeline", "table_id": "", "view_type": "timeline"}
   }
 ]$$::jsonb,
 '[]'::jsonb),

-- Create & Review category
('form', 'Form', 'A form to collect and submit data', '📝', 'create_review', false, 0,
 $$[
   {
     "type": "text",
     "x": 0,
     "y": 0,
     "w": 12,
     "h": 2,
     "config": {"text_content": "# Form Title\n\nFill out the form below to submit your information."}
   },
   {
     "type": "form",
     "x": 0,
     "y": 2,
     "w": 8,
     "h": 10,
     "config": {"title": "Submission Form", "table_id": ""}
   },
   {
     "type": "text",
     "x": 8,
     "y": 2,
     "w": 4,
     "h": 10,
     "config": {"text_content": "## Instructions\n\n- Fill out all required fields\n- Click submit when done"}
   }
 ]$$::jsonb,
 '[]'::jsonb),

('record_review', 'Record Review', 'Review and approve individual records', '✅', 'create_review', false, 1,
 $$[
   {
     "type": "text",
     "x": 0,
     "y": 0,
     "w": 12,
     "h": 1,
     "config": {"text_content": "# Record Review\n\nReview and approve records below."}
   },
   {
     "type": "grid",
     "x": 0,
     "y": 1,
     "w": 6,
     "h": 10,
     "config": {"title": "Pending Review", "table_id": ""}
   },
   {
     "type": "record",
     "x": 6,
     "y": 1,
     "w": 6,
     "h": 10,
     "config": {"title": "Record Details", "table_id": ""}
   }
 ]$$::jsonb,
 '[]'::jsonb),

-- Insights category
('dashboard', 'Dashboard', 'Overview with KPIs, charts, and data grid', '📈', 'insights', false, 0,
 $$[
   {
     "type": "kpi",
     "x": 0,
     "y": 0,
     "w": 3,
     "h": 3,
     "config": {"title": "Total Records", "table_id": "", "kpi_aggregate": "count"}
   },
   {
     "type": "kpi",
     "x": 3,
     "y": 0,
     "w": 3,
     "h": 3,
     "config": {"title": "This Month", "table_id": "", "kpi_aggregate": "count"}
   },
   {
     "type": "kpi",
     "x": 6,
     "y": 0,
     "w": 3,
     "h": 3,
     "config": {"title": "Active", "table_id": "", "kpi_aggregate": "count"}
   },
   {
     "type": "kpi",
     "x": 9,
     "y": 0,
     "w": 3,
     "h": 3,
     "config": {"title": "Pending", "table_id": "", "kpi_aggregate": "count"}
   },
   {
     "type": "chart",
     "x": 0,
     "y": 3,
     "w": 6,
     "h": 4,
     "config": {"title": "Trends", "table_id": "", "chart_type": "line"}
   },
   {
     "type": "chart",
     "x": 6,
     "y": 3,
     "w": 6,
     "h": 4,
     "config": {"title": "Distribution", "table_id": "", "chart_type": "pie"}
   },
   {
     "type": "grid",
     "x": 0,
     "y": 7,
     "w": 12,
     "h": 6,
     "config": {"title": "Recent Records", "table_id": ""}
   }
 ]$$::jsonb,
 '[]'::jsonb),

('overview', 'Overview', 'High-level summary with key information', '👁️', 'insights', false, 1,
 $$[
   {
     "type": "text",
     "x": 0,
     "y": 0,
     "w": 12,
     "h": 2,
     "config": {"text_content": "# Overview\n\nGet a quick glance at your key metrics and data."}
   },
   {
     "type": "grid",
     "x": 0,
     "y": 2,
     "w": 8,
     "h": 8,
     "config": {"title": "Data Grid", "table_id": ""}
   },
   {
     "type": "kpi",
     "x": 8,
     "y": 2,
     "w": 4,
     "h": 4,
     "config": {"title": "Total", "table_id": "", "kpi_aggregate": "count"}
   },
   {
     "type": "chart",
     "x": 8,
     "y": 6,
     "w": 4,
     "h": 4,
     "config": {"title": "Summary", "table_id": "", "chart_type": "bar"}
   }
 ]$$::jsonb,
 '[]'::jsonb),

-- Advanced category
('team', 'Team', 'Collaborative workspace for team members', '👥', 'advanced', true, 0,
 $$[
   {
     "type": "text",
     "x": 0,
     "y": 0,
     "w": 12,
     "h": 2,
     "config": {"text_content": "# Team Workspace\n\nCollaborate with your team on shared data."}
   },
   {
     "type": "grid",
     "x": 0,
     "y": 2,
     "w": 12,
     "h": 8,
     "config": {"title": "Team Data", "table_id": ""}
   }
 ]$$::jsonb,
 '[]'::jsonb),

('custom', 'Custom', 'Fully customizable page - start from scratch', '🎨', 'advanced', true, 1,
 '[]'::jsonb,
 '[]'::jsonb),

-- Other category
('blank', 'Blank', 'Start with an empty canvas', '⬜', 'other', false, 0,
 $$[
   {
     "type": "text",
     "x": 0,
     "y": 0,
     "w": 12,
     "h": 2,
     "config": {"text_content": "# Welcome to your new interface\n\nClick the \"Edit interface\" button to start adding blocks."}
   }
 ]$$::jsonb,
 '[]'::jsonb)

ON CONFLICT (type) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE page_type_templates IS 'Dynamic page type templates that define default block layouts for interface pages';
COMMENT ON COLUMN page_type_templates.default_blocks IS 'JSON array of block definitions: [{type, x, y, w, h, config}]';
COMMENT ON COLUMN page_type_templates.allowed_blocks IS 'JSON array of allowed block types (empty = all allowed)';
COMMENT ON COLUMN views.page_type IS 'References page_type_templates.type - defines the template used for this interface page';

