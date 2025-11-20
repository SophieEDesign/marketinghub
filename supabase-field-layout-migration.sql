-- ============================================
-- ADD FIELD LAYOUT TO SETTINGS TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- Insert field_layout settings for all tables (if they don't exist)
INSERT INTO public.settings (key, value)
VALUES 
  ('field_layout_content', '[]'::jsonb),
  ('field_layout_campaigns', '[]'::jsonb),
  ('field_layout_contacts', '[]'::jsonb),
  ('field_layout_ideas', '[]'::jsonb),
  ('field_layout_media', '[]'::jsonb),
  ('field_layout_tasks', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- VERIFY
-- ============================================
-- After running, check:
-- SELECT * FROM settings WHERE key LIKE 'field_layout_%';
-- Should return 6 rows, one for each table
-- ============================================

