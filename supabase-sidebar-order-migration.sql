-- ============================================
-- ADD SIDEBAR ORDER TO SETTINGS TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- Insert sidebar_order setting (if it doesn't exist)
INSERT INTO public.settings (key, value)
VALUES ('sidebar_order', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- VERIFY
-- ============================================
-- After running, check:
-- SELECT * FROM settings WHERE key = 'sidebar_order';
-- Should return one row with an empty array []
-- ============================================

