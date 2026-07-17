-- Versioning System Migration
-- Generic versioning tables for Interfaces, Pages, Views, Blocks, and Automations

-- 1. Entity Versions Table
-- Stores snapshots of entities at different points in time
CREATE TABLE IF NOT EXISTS entity_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('interface', 'page', 'view', 'block', 'automation')),
  entity_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT NOT NULL CHECK (reason IN ('manual_save', 'autosave', 'rollback', 'restore')),
  
  -- Ensure version numbers are sequential per entity
  UNIQUE(entity_type, entity_id, version_number)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_entity_versions_entity ON entity_versions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_versions_created_at ON entity_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_versions_created_by ON entity_versions(created_by);

-- 2. Entity Activity Log Table
-- Stores audit trail of all actions performed on entities
CREATE TABLE IF NOT EXISTS entity_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('interface', 'page', 'view', 'block', 'automation')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'reorder', 'publish', 'unpublish', 'restore', 'duplicate')),
  metadata JSONB DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Store related entity info for context (e.g., block belongs to page)
  related_entity_type TEXT,
  related_entity_id UUID
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_entity_activity_log_entity ON entity_activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_activity_log_created_at ON entity_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_activity_log_user ON entity_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_activity_log_related ON entity_activity_log(related_entity_type, related_entity_id);

-- 3. Version Configuration Table
-- Stores per-entity configuration for versioning (e.g., max versions to keep)
CREATE TABLE IF NOT EXISTS entity_version_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('interface', 'page', 'view', 'block', 'automation')),
  entity_id UUID NOT NULL,
  max_versions INTEGER NOT NULL DEFAULT 25,
  auto_save_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_save_interval_seconds INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(entity_type, entity_id)
);

-- Index for config lookups
CREATE INDEX IF NOT EXISTS idx_entity_version_config_entity ON entity_version_config(entity_type, entity_id);

-- 4. RLS Policies for entity_versions
ALTER TABLE entity_versions ENABLE ROW LEVEL SECURITY;

-- Users can read versions for entities they have access to
CREATE POLICY "Users can read versions for accessible entities"
  ON entity_versions FOR SELECT
  USING (
    -- Allow if user created it
    created_by = auth.uid()
    OR
    -- Allow if user has access to the entity (simplified - adjust based on your permission system)
    EXISTS (
      SELECT 1 FROM views v
      WHERE v.id = entity_versions.entity_id
      AND entity_versions.entity_type = 'page'
      AND (v.owner_id = auth.uid() OR v.access_level = 'public' OR v.access_level = 'authenticated')
    )
    OR
    -- Admin can see all
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  );

-- Users can create versions for entities they can edit
CREATE POLICY "Users can create versions for editable entities"
  ON entity_versions FOR INSERT
  WITH CHECK (
    -- Allow if user can edit the entity (simplified - adjust based on your permission system)
    EXISTS (
      SELECT 1 FROM views v
      WHERE v.id = entity_versions.entity_id
      AND entity_versions.entity_type = 'page'
      AND (v.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'editor')
      ))
    )
    OR
    -- Admin can create versions for all
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  );

-- 5. RLS Policies for entity_activity_log
ALTER TABLE entity_activity_log ENABLE ROW LEVEL SECURITY;

-- Users can read activity logs for entities they have access to
CREATE POLICY "Users can read activity logs for accessible entities"
  ON entity_activity_log FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM views v
      WHERE v.id = entity_activity_log.entity_id
      AND entity_activity_log.entity_type = 'page'
      AND (v.owner_id = auth.uid() OR v.access_level = 'public' OR v.access_level = 'authenticated')
    )
    OR
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  );

-- Users can create activity logs (system creates these)
CREATE POLICY "Users can create activity logs"
  ON entity_activity_log FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 6. RLS Policies for entity_version_config
ALTER TABLE entity_version_config ENABLE ROW LEVEL SECURITY;

-- Users can read config for entities they have access to
CREATE POLICY "Users can read version config for accessible entities"
  ON entity_version_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM views v
      WHERE v.id = entity_version_config.entity_id
      AND entity_version_config.entity_type = 'page'
      AND (v.owner_id = auth.uid() OR v.access_level = 'public' OR v.access_level = 'authenticated')
    )
    OR
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  );

-- Users can update config for entities they can edit
CREATE POLICY "Users can update version config for editable entities"
  ON entity_version_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM views v
      WHERE v.id = entity_version_config.entity_id
      AND entity_version_config.entity_type = 'page'
      AND (v.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'editor')
      ))
    )
    OR
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  );

-- 7. Function to get next version number for an entity
CREATE OR REPLACE FUNCTION get_next_version_number(
  p_entity_type TEXT,
  p_entity_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_max_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO v_max_version
  FROM entity_versions
  WHERE entity_type = p_entity_type
    AND entity_id = p_entity_id;
  
  RETURN v_max_version;
END;
$$ LANGUAGE plpgsql;

-- 8. Function to clean up old versions (keep only max_versions)
CREATE OR REPLACE FUNCTION cleanup_old_versions(
  p_entity_type TEXT,
  p_entity_id UUID
) RETURNS void AS $$
DECLARE
  v_max_versions INTEGER;
  v_current_count INTEGER;
BEGIN
  -- Get max versions from config or use default
  SELECT COALESCE(max_versions, 25)
  INTO v_max_versions
  FROM entity_version_config
  WHERE entity_type = p_entity_type
    AND entity_id = p_entity_id;
  
  -- Count current versions
  SELECT COUNT(*)
  INTO v_current_count
  FROM entity_versions
  WHERE entity_type = p_entity_type
    AND entity_id = p_entity_id;
  
  -- Delete oldest versions if over limit
  IF v_current_count > v_max_versions THEN
    DELETE FROM entity_versions
    WHERE entity_type = p_entity_type
      AND entity_id = p_entity_id
      AND id IN (
        SELECT id
        FROM entity_versions
        WHERE entity_type = p_entity_type
          AND entity_id = p_entity_id
        ORDER BY version_number ASC
        LIMIT (v_current_count - v_max_versions)
      );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 9. Trigger to automatically clean up old versions after insert
CREATE OR REPLACE FUNCTION trigger_cleanup_old_versions()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM cleanup_old_versions(NEW.entity_type, NEW.entity_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cleanup_versions_after_insert
  AFTER INSERT ON entity_versions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_cleanup_old_versions();

-- 10. Comments for documentation
COMMENT ON TABLE entity_versions IS 'Stores version snapshots of entities (interfaces, pages, views, blocks, automations)';
COMMENT ON TABLE entity_activity_log IS 'Audit trail of all actions performed on entities';
COMMENT ON TABLE entity_version_config IS 'Configuration for versioning behavior per entity';
COMMENT ON COLUMN entity_versions.reason IS 'Reason for version creation: manual_save, autosave, rollback, or restore';
COMMENT ON COLUMN entity_activity_log.metadata IS 'Additional context about the action (e.g., field changed, old value, new value)';

