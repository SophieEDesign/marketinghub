-- ============================================
-- ADD DASHBOARD LAYOUT TO SETTINGS TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- Insert dashboard_layout setting (if it doesn't exist)
INSERT INTO public.settings (key, value)
VALUES ('dashboard_layout', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- VERIFY
-- ============================================
-- After running, check:
-- SELECT * FROM settings WHERE key = 'dashboard_layout';
-- Should return one row with an empty array []
-- ============================================

