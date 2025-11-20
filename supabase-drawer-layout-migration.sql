-- ============================================
-- ADD DRAWER LAYOUT TO SETTINGS TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- Insert drawer_layout settings for all tables (if they don't exist)
INSERT INTO public.settings (key, value)
VALUES 
  ('drawer_layout_content', '[]'::jsonb),
  ('drawer_layout_campaigns', '[]'::jsonb),
  ('drawer_layout_contacts', '[]'::jsonb),
  ('drawer_layout_ideas', '[]'::jsonb),
  ('drawer_layout_media', '[]'::jsonb),
  ('drawer_layout_tasks', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- VERIFY
-- ============================================
-- After running, check:
-- SELECT * FROM settings WHERE key LIKE 'drawer_layout_%';
-- Should return 6 rows, one for each table
-- ============================================

