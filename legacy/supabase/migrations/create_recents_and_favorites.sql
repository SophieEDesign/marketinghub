-- Create Recents and Favorites Tables
-- This migration creates the tables and functions needed for the recents/favorites feature

-- 1. Recent Items Table
-- Tracks what users have recently viewed/opened
CREATE TABLE IF NOT EXISTS public.recent_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('table', 'page', 'view', 'interface', 'block', 'automation')),
  entity_id UUID NOT NULL,
  last_opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One entry per user per entity (update timestamp on re-open)
  UNIQUE(user_id, entity_type, entity_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_recent_items_user ON public.recent_items(user_id);
CREATE INDEX IF NOT EXISTS idx_recent_items_user_type ON public.recent_items(user_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_recent_items_last_opened ON public.recent_items(last_opened_at DESC);

-- 2. Favorites Table
-- Tracks user-starred items
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('table', 'page', 'view', 'interface', 'block', 'automation')),
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One favorite per user per entity
  UNIQUE(user_id, entity_type, entity_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_type ON public.favorites(user_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON public.favorites(created_at DESC);

-- 3. RLS Policies for recent_items
ALTER TABLE public.recent_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recent items"
  ON public.recent_items FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own recent items"
  ON public.recent_items FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own recent items"
  ON public.recent_items FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own recent items"
  ON public.recent_items FOR DELETE
  USING (user_id = auth.uid());

-- 4. RLS Policies for favorites
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favorites"
  ON public.favorites FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own favorites"
  ON public.favorites FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own favorites"
  ON public.favorites FOR DELETE
  USING (user_id = auth.uid());

-- 5. Function to update or insert recent item
-- Note: PostgREST requires parameters in a specific order for RPC calls
CREATE OR REPLACE FUNCTION public.upsert_recent_item(
  p_user_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID
) RETURNS void AS $$
BEGIN
  INSERT INTO public.recent_items (user_id, entity_type, entity_id, last_opened_at)
  VALUES (p_user_id, p_entity_type, p_entity_id, NOW())
  ON CONFLICT (user_id, entity_type, entity_id)
  DO UPDATE SET last_opened_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.upsert_recent_item(UUID, TEXT, UUID) TO authenticated;

-- 6. Function to clean up old recent items (keep only last N per user)
CREATE OR REPLACE FUNCTION public.cleanup_old_recent_items(
  p_user_id UUID,
  p_max_items INTEGER DEFAULT 50
) RETURNS void AS $$
BEGIN
  DELETE FROM public.recent_items
  WHERE user_id = p_user_id
    AND id NOT IN (
      SELECT id
      FROM public.recent_items
      WHERE user_id = p_user_id
      ORDER BY last_opened_at DESC
      LIMIT p_max_items
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.cleanup_old_recent_items(UUID, INTEGER) TO authenticated;

-- 7. Trigger to clean up old recent items after insert
CREATE OR REPLACE FUNCTION public.trigger_cleanup_recent_items()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.cleanup_old_recent_items(NEW.user_id, 50);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cleanup_recent_items_after_insert
  AFTER INSERT ON public.recent_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_cleanup_recent_items();

-- 8. Comments for documentation
COMMENT ON TABLE public.recent_items IS 'Tracks recently viewed/opened items per user';
COMMENT ON TABLE public.favorites IS 'Tracks user-starred/favorited items';
COMMENT ON FUNCTION public.upsert_recent_item IS 'Updates or inserts a recent item, updating timestamp if exists';
COMMENT ON FUNCTION public.cleanup_old_recent_items IS 'Removes old recent items, keeping only the most recent N items per user';

