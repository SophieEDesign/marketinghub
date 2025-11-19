-- ============================================
-- ADD DEFAULT CHANNEL OPTIONS TO CHANNELS FIELD
-- Run this in Supabase SQL Editor
-- ============================================

-- Update the channels field to include default channel options
UPDATE table_fields
SET options = '{
  "values": [
    {"id": "linkedin", "label": "LinkedIn", "color": "#0077b5"},
    {"id": "facebook", "label": "Facebook", "color": "#1877f2"},
    {"id": "instagram", "label": "Instagram", "color": "#e4405f"},
    {"id": "x", "label": "X (Twitter)", "color": "#000000"},
    {"id": "twitter", "label": "Twitter", "color": "#1da1f2"},
    {"id": "website", "label": "Website", "color": "#4a90e2"},
    {"id": "blog", "label": "Blog", "color": "#ff6b6b"},
    {"id": "email", "label": "Email", "color": "#6c5ce7"},
    {"id": "youtube", "label": "YouTube", "color": "#ff0000"},
    {"id": "tiktok", "label": "TikTok", "color": "#000000"},
    {"id": "pr", "label": "PR", "color": "#8e44ad"},
    {"id": "internal", "label": "Internal", "color": "#95a5a6"}
  ]
}'::jsonb
WHERE table_id = 'content' 
  AND field_key = 'channels'
  AND type = 'multi_select';

-- ============================================
-- VERIFY
-- ============================================
-- After running, check:
-- SELECT field_key, label, type, options 
-- FROM table_fields 
-- WHERE field_key = 'channels';
-- 
-- Should show options with 12 channel values
-- ============================================

