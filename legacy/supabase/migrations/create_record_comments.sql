-- Record Comments Table
-- Enables discussion/commenting on records across all tables.
-- Links comments to records via table_id (metadata) + record_id (row id in dynamic table).

-- Drop if exists (handles partial/failed runs with wrong schema)
DROP TABLE IF EXISTS public.record_comments CASCADE;

CREATE TABLE public.record_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  record_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_record_comments_table_record
  ON public.record_comments(table_id, record_id);
CREATE INDEX IF NOT EXISTS idx_record_comments_user
  ON public.record_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_record_comments_created_at
  ON public.record_comments(created_at DESC);

ALTER TABLE public.record_comments ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read comments for any record (access gated by API/record view context)
CREATE POLICY "Authenticated users can read record comments"
  ON public.record_comments FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can add comments (API verifies table/record access)
CREATE POLICY "Authenticated users can insert record comments"
  ON public.record_comments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update only their own comments
CREATE POLICY "Users can update own comments"
  ON public.record_comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete only their own comments
CREATE POLICY "Users can delete own comments"
  ON public.record_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.record_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER record_comments_updated_at
  BEFORE UPDATE ON public.record_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.record_comments_updated_at();

COMMENT ON TABLE public.record_comments IS 'Comments/discussion on records across all tables';
