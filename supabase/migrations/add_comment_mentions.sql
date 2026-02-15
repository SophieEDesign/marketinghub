-- Comment Mentions Table
-- Tracks which users were @mentioned in each comment (for notifications).

CREATE TABLE IF NOT EXISTS public.comment_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.record_comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(comment_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_mentions_mentioned_user
  ON public.comment_mentions(mentioned_user_id);

ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert (gated by API - comment author only)
CREATE POLICY "Authenticated users can insert comment mentions"
  ON public.comment_mentions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can select their own mentions (for notification center)
CREATE POLICY "Users can select own mentions"
  ON public.comment_mentions FOR SELECT
  TO authenticated
  USING (mentioned_user_id = auth.uid());

COMMENT ON TABLE public.comment_mentions IS 'Tracks @mentions in record comments for email notifications';
