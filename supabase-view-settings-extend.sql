-- Extend view_settings table with new columns for view configuration
-- Run this in Supabase SQL Editor

ALTER TABLE view_settings 
ADD COLUMN IF NOT EXISTS visible_fields JSONB DEFAULT '[]'::jsonb;

ALTER TABLE view_settings 
ADD COLUMN IF NOT EXISTS field_order JSONB DEFAULT '[]'::jsonb;

ALTER TABLE view_settings 
ADD COLUMN IF NOT EXISTS kanban_group_field TEXT;

ALTER TABLE view_settings 
ADD COLUMN IF NOT EXISTS calendar_date_field TEXT;

ALTER TABLE view_settings 
ADD COLUMN IF NOT EXISTS timeline_date_field TEXT;

ALTER TABLE view_settings 
ADD COLUMN IF NOT EXISTS row_height TEXT DEFAULT 'medium'; -- options: compact, medium, tall

ALTER TABLE view_settings 
ADD COLUMN IF NOT EXISTS card_fields JSONB DEFAULT '[]'::jsonb;

