-- ============================================================================
-- Schema Audit Fixes Migration
-- Generated from comprehensive schema audit
-- Priority: CRITICAL and HIGH priority fixes
-- ============================================================================

-- ============================================================================
-- 1. ADD MISSING INDEXES ON FOREIGN KEYS (CRITICAL)
-- ============================================================================

-- automation_logs
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_run_id ON automation_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_by ON automation_logs(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_automation_logs_updated_by ON automation_logs(updated_by) WHERE updated_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON automation_logs(created_at DESC);

-- automation_runs
CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_id ON automation_runs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON automation_runs(status);
CREATE INDEX IF NOT EXISTS idx_automation_runs_started_at ON automation_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_automation_runs_created_by ON automation_runs(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_automation_runs_updated_by ON automation_runs(updated_by) WHERE updated_by IS NOT NULL;

-- automations
CREATE INDEX IF NOT EXISTS idx_automations_status ON automations(status);
CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations(enabled);
CREATE INDEX IF NOT EXISTS idx_automations_created_by ON automations(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_automations_updated_by ON automations(updated_by) WHERE updated_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_automations_archived ON automations(is_archived) WHERE is_archived = false;

-- entity_activity_log
CREATE INDEX IF NOT EXISTS idx_entity_activity_log_entity ON entity_activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_activity_log_entity_type ON entity_activity_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_activity_log_entity_action ON entity_activity_log(entity_type, entity_id, action);
CREATE INDEX IF NOT EXISTS idx_entity_activity_log_user_id ON entity_activity_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entity_activity_log_related ON entity_activity_log(related_entity_type, related_entity_id) 
  WHERE related_entity_type IS NOT NULL AND related_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entity_activity_log_created_at ON entity_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_activity_log_updated_by ON entity_activity_log(updated_by) WHERE updated_by IS NOT NULL;

-- entity_version_config
CREATE INDEX IF NOT EXISTS idx_entity_version_config_entity ON entity_version_config(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_version_config_entity_type ON entity_version_config(entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_version_config_created_by ON entity_version_config(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entity_version_config_updated_by ON entity_version_config(updated_by) WHERE updated_by IS NOT NULL;

-- entity_versions
CREATE INDEX IF NOT EXISTS idx_entity_versions_entity ON entity_versions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_versions_entity_type ON entity_versions(entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_versions_entity_version ON entity_versions(entity_type, entity_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_entity_versions_created_at ON entity_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_versions_created_by ON entity_versions(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entity_versions_updated_by ON entity_versions(updated_by) WHERE updated_by IS NOT NULL;

-- favorites
CREATE INDEX IF NOT EXISTS idx_favorites_user_entity ON favorites(user_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);

-- grid_view_settings
CREATE INDEX IF NOT EXISTS idx_grid_view_settings_created_by ON grid_view_settings(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grid_view_settings_updated_by ON grid_view_settings(updated_by) WHERE updated_by IS NOT NULL;

-- interface_categories
CREATE INDEX IF NOT EXISTS idx_interface_categories_created_by ON interface_categories(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interface_categories_updated_by ON interface_categories(updated_by) WHERE updated_by IS NOT NULL;

-- interface_groups
CREATE INDEX IF NOT EXISTS idx_interface_groups_workspace_id ON interface_groups(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interface_groups_workspace_order ON interface_groups(workspace_id, order_index) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interface_groups_created_by ON interface_groups(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interface_groups_updated_by ON interface_groups(updated_by) WHERE updated_by IS NOT NULL;

-- interface_pages
CREATE INDEX IF NOT EXISTS idx_interface_pages_group_id ON interface_pages(group_id);
CREATE INDEX IF NOT EXISTS idx_interface_pages_group_order ON interface_pages(group_id, order_index);
CREATE INDEX IF NOT EXISTS idx_interface_pages_page_type ON interface_pages(page_type);
CREATE INDEX IF NOT EXISTS idx_interface_pages_saved_view_id ON interface_pages(saved_view_id) WHERE saved_view_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interface_pages_dashboard_layout_id ON interface_pages(dashboard_layout_id) WHERE dashboard_layout_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interface_pages_form_config_id ON interface_pages(form_config_id) WHERE form_config_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interface_pages_record_config_id ON interface_pages(record_config_id) WHERE record_config_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interface_pages_is_admin_only ON interface_pages(is_admin_only);
CREATE INDEX IF NOT EXISTS idx_interface_pages_created_by ON interface_pages(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interface_pages_updated_by ON interface_pages(updated_by) WHERE updated_by IS NOT NULL;

-- interface_permissions
CREATE INDEX IF NOT EXISTS idx_interface_permissions_interface_id ON interface_permissions(interface_id);
CREATE INDEX IF NOT EXISTS idx_interface_permissions_created_by ON interface_permissions(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interface_permissions_updated_by ON interface_permissions(updated_by) WHERE updated_by IS NOT NULL;

-- interface_views
CREATE INDEX IF NOT EXISTS idx_interface_views_interface_id ON interface_views(interface_id);
CREATE INDEX IF NOT EXISTS idx_interface_views_view_id ON interface_views(view_id);
CREATE INDEX IF NOT EXISTS idx_interface_views_created_by ON interface_views(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interface_views_updated_by ON interface_views(updated_by) WHERE updated_by IS NOT NULL;

-- interfaces
CREATE INDEX IF NOT EXISTS idx_interfaces_category_id ON interfaces(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interfaces_is_default ON interfaces(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_interfaces_archived ON interfaces(is_archived) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_interfaces_created_by ON interfaces(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interfaces_updated_by ON interfaces(updated_by) WHERE updated_by IS NOT NULL;

-- page_type_templates
CREATE INDEX IF NOT EXISTS idx_page_type_templates_created_by ON page_type_templates(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_page_type_templates_updated_by ON page_type_templates(updated_by) WHERE updated_by IS NOT NULL;

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_created_by ON profiles(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_updated_by ON profiles(updated_by) WHERE updated_by IS NOT NULL;

-- recent_items
CREATE INDEX IF NOT EXISTS idx_recent_items_user_entity ON recent_items(user_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_recent_items_user ON recent_items(user_id);
CREATE INDEX IF NOT EXISTS idx_recent_items_last_opened ON recent_items(last_opened_at DESC);

-- sidebar_categories
CREATE INDEX IF NOT EXISTS idx_sidebar_categories_created_by ON sidebar_categories(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sidebar_categories_updated_by ON sidebar_categories(updated_by) WHERE updated_by IS NOT NULL;

-- sidebar_items
CREATE INDEX IF NOT EXISTS idx_sidebar_items_category_id ON sidebar_items(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sidebar_items_created_by ON sidebar_items(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sidebar_items_updated_by ON sidebar_items(updated_by) WHERE updated_by IS NOT NULL;

-- table_fields
CREATE INDEX IF NOT EXISTS idx_table_fields_created_by ON table_fields(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_table_fields_updated_by ON table_fields(updated_by) WHERE updated_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_table_fields_table_order ON table_fields(table_id, order_index);

-- table_rows
CREATE INDEX IF NOT EXISTS idx_table_rows_table_id ON table_rows(table_id);
CREATE INDEX IF NOT EXISTS idx_table_rows_created_by ON table_rows(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_table_rows_updated_by ON table_rows(updated_by) WHERE updated_by IS NOT NULL;

-- tables
CREATE INDEX IF NOT EXISTS idx_tables_archived ON tables(is_archived) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_tables_created_by ON tables(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tables_updated_by ON tables(updated_by) WHERE updated_by IS NOT NULL;

-- user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_created_by ON user_roles(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_updated_by ON user_roles(updated_by) WHERE updated_by IS NOT NULL;

-- view_blocks
CREATE INDEX IF NOT EXISTS idx_view_blocks_view_id ON view_blocks(view_id) WHERE view_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_view_blocks_page_id ON view_blocks(page_id) WHERE page_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_view_blocks_page_position ON view_blocks(page_id, position_x, position_y) WHERE page_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_view_blocks_view_position ON view_blocks(view_id, position_x, position_y) WHERE view_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_view_blocks_created_by ON view_blocks(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_view_blocks_updated_by ON view_blocks(updated_by) WHERE updated_by IS NOT NULL;

-- view_fields
CREATE INDEX IF NOT EXISTS idx_view_fields_view_id ON view_fields(view_id) WHERE view_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_view_fields_created_by ON view_fields(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_view_fields_updated_by ON view_fields(updated_by) WHERE updated_by IS NOT NULL;

-- view_filters
CREATE INDEX IF NOT EXISTS idx_view_filters_view_id ON view_filters(view_id) WHERE view_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_view_filters_created_by ON view_filters(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_view_filters_updated_by ON view_filters(updated_by) WHERE updated_by IS NOT NULL;

-- view_sorts
CREATE INDEX IF NOT EXISTS idx_view_sorts_view_id ON view_sorts(view_id) WHERE view_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_view_sorts_created_by ON view_sorts(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_view_sorts_updated_by ON view_sorts(updated_by) WHERE updated_by IS NOT NULL;

-- view_tabs
CREATE INDEX IF NOT EXISTS idx_view_tabs_view_id ON view_tabs(view_id) WHERE view_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_view_tabs_created_by ON view_tabs(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_view_tabs_updated_by ON view_tabs(updated_by) WHERE updated_by IS NOT NULL;

-- views
CREATE INDEX IF NOT EXISTS idx_views_table_id ON views(table_id) WHERE table_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_views_table_order ON views(table_id, order_index) WHERE table_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_views_group_id ON views(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_views_group_order ON views(group_id, order_index) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_views_type ON views(type);
CREATE INDEX IF NOT EXISTS idx_views_default_view ON views(default_view) WHERE default_view IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_views_is_default ON views(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_views_is_admin_only ON views(is_admin_only);
CREATE INDEX IF NOT EXISTS idx_views_archived ON views(is_archived) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_views_owner_id ON views(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_views_created_by ON views(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_views_updated_by ON views(updated_by) WHERE updated_by IS NOT NULL;

-- workspace_settings
CREATE INDEX IF NOT EXISTS idx_workspace_settings_default_interface_id ON workspace_settings(default_interface_id) WHERE default_interface_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_settings_created_by ON workspace_settings(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_settings_updated_by ON workspace_settings(updated_by) WHERE updated_by IS NOT NULL;

-- workspaces
CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON workspaces(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspaces_updated_by ON workspaces(updated_by) WHERE updated_by IS NOT NULL;

-- ============================================================================
-- 2. ADD ON DELETE CASCADE TO FOREIGN KEYS (CRITICAL)
-- ============================================================================

-- automation_logs
ALTER TABLE automation_logs
  DROP CONSTRAINT IF EXISTS automation_logs_automation_id_fkey,
  DROP CONSTRAINT IF EXISTS automation_logs_run_id_fkey;

ALTER TABLE automation_logs
  ADD CONSTRAINT automation_logs_automation_id_fkey 
  FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
  ADD CONSTRAINT automation_logs_run_id_fkey 
  FOREIGN KEY (run_id) REFERENCES automation_runs(id) ON DELETE CASCADE;

-- automation_runs
ALTER TABLE automation_runs
  DROP CONSTRAINT IF EXISTS automation_runs_automation_id_fkey;

ALTER TABLE automation_runs
  ADD CONSTRAINT automation_runs_automation_id_fkey 
  FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE;

-- grid_view_settings
ALTER TABLE grid_view_settings
  DROP CONSTRAINT IF EXISTS grid_view_settings_view_id_fkey;

ALTER TABLE grid_view_settings
  ADD CONSTRAINT grid_view_settings_view_id_fkey 
  FOREIGN KEY (view_id) REFERENCES views(id) ON DELETE CASCADE;

-- interface_pages
ALTER TABLE interface_pages
  DROP CONSTRAINT IF EXISTS interface_pages_group_id_fkey,
  DROP CONSTRAINT IF EXISTS interface_pages_saved_view_id_fkey;

ALTER TABLE interface_pages
  ADD CONSTRAINT interface_pages_group_id_fkey 
  FOREIGN KEY (group_id) REFERENCES interface_groups(id) ON DELETE CASCADE,
  ADD CONSTRAINT interface_pages_saved_view_id_fkey 
  FOREIGN KEY (saved_view_id) REFERENCES views(id) ON DELETE SET NULL;

-- interface_permissions
ALTER TABLE interface_permissions
  DROP CONSTRAINT IF EXISTS interface_permissions_interface_id_fkey;

ALTER TABLE interface_permissions
  ADD CONSTRAINT interface_permissions_interface_id_fkey 
  FOREIGN KEY (interface_id) REFERENCES interfaces(id) ON DELETE CASCADE;

-- interface_views
ALTER TABLE interface_views
  DROP CONSTRAINT IF EXISTS interface_views_interface_id_fkey,
  DROP CONSTRAINT IF EXISTS interface_views_view_id_fkey;

ALTER TABLE interface_views
  ADD CONSTRAINT interface_views_interface_id_fkey 
  FOREIGN KEY (interface_id) REFERENCES interfaces(id) ON DELETE CASCADE,
  ADD CONSTRAINT interface_views_view_id_fkey 
  FOREIGN KEY (view_id) REFERENCES views(id) ON DELETE CASCADE;

-- table_fields
ALTER TABLE table_fields
  DROP CONSTRAINT IF EXISTS table_fields_table_id_fkey;

ALTER TABLE table_fields
  ADD CONSTRAINT table_fields_table_id_fkey 
  FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE;

-- table_rows
ALTER TABLE table_rows
  DROP CONSTRAINT IF EXISTS table_rows_table_id_fkey;

ALTER TABLE table_rows
  ADD CONSTRAINT table_rows_table_id_fkey 
  FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE;

-- view_blocks
ALTER TABLE view_blocks
  DROP CONSTRAINT IF EXISTS view_blocks_view_id_fkey,
  DROP CONSTRAINT IF EXISTS view_blocks_page_id_fkey;

ALTER TABLE view_blocks
  ADD CONSTRAINT view_blocks_view_id_fkey 
  FOREIGN KEY (view_id) REFERENCES views(id) ON DELETE CASCADE,
  ADD CONSTRAINT view_blocks_page_id_fkey 
  FOREIGN KEY (page_id) REFERENCES interface_pages(id) ON DELETE CASCADE;

-- view_fields
ALTER TABLE view_fields
  DROP CONSTRAINT IF EXISTS view_fields_view_id_fkey;

ALTER TABLE view_fields
  ADD CONSTRAINT view_fields_view_id_fkey 
  FOREIGN KEY (view_id) REFERENCES views(id) ON DELETE CASCADE;

-- view_filters
ALTER TABLE view_filters
  DROP CONSTRAINT IF EXISTS view_filters_view_id_fkey;

ALTER TABLE view_filters
  ADD CONSTRAINT view_filters_view_id_fkey 
  FOREIGN KEY (view_id) REFERENCES views(id) ON DELETE CASCADE;

-- view_sorts
ALTER TABLE view_sorts
  DROP CONSTRAINT IF EXISTS view_sorts_view_id_fkey;

ALTER TABLE view_sorts
  ADD CONSTRAINT view_sorts_view_id_fkey 
  FOREIGN KEY (view_id) REFERENCES views(id) ON DELETE CASCADE;

-- views
ALTER TABLE views
  DROP CONSTRAINT IF EXISTS views_table_id_fkey,
  DROP CONSTRAINT IF EXISTS views_group_id_fkey,
  DROP CONSTRAINT IF EXISTS views_default_view_fkey;

ALTER TABLE views
  ADD CONSTRAINT views_table_id_fkey 
  FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
  ADD CONSTRAINT views_group_id_fkey 
  FOREIGN KEY (group_id) REFERENCES interface_groups(id) ON DELETE SET NULL,
  ADD CONSTRAINT views_default_view_fkey 
  FOREIGN KEY (default_view) REFERENCES views(id) ON DELETE SET NULL;

-- ============================================================================
-- 3. ADD CHECK CONSTRAINTS (HIGH PRIORITY)
-- ============================================================================

-- interface_pages
ALTER TABLE interface_pages
  DROP CONSTRAINT IF EXISTS interface_pages_order_index_check;

ALTER TABLE interface_pages
  ADD CONSTRAINT interface_pages_order_index_check 
  CHECK (order_index >= 0);

-- interface_groups
ALTER TABLE interface_groups
  DROP CONSTRAINT IF EXISTS interface_groups_order_index_check;

ALTER TABLE interface_groups
  ADD CONSTRAINT interface_groups_order_index_check 
  CHECK (order_index >= 0);

-- views
ALTER TABLE views
  DROP CONSTRAINT IF EXISTS views_order_index_check;

ALTER TABLE views
  ADD CONSTRAINT views_order_index_check 
  CHECK (order_index >= 0);

-- table_fields
ALTER TABLE table_fields
  DROP CONSTRAINT IF EXISTS table_fields_position_check,
  DROP CONSTRAINT IF EXISTS table_fields_order_index_check;

ALTER TABLE table_fields
  ADD CONSTRAINT table_fields_position_check 
  CHECK (position >= 0),
  ADD CONSTRAINT table_fields_order_index_check 
  CHECK (order_index >= 0);

-- view_blocks
ALTER TABLE view_blocks
  DROP CONSTRAINT IF EXISTS view_blocks_width_check,
  DROP CONSTRAINT IF EXISTS view_blocks_height_check,
  DROP CONSTRAINT IF EXISTS view_blocks_position_x_check,
  DROP CONSTRAINT IF EXISTS view_blocks_position_y_check;

ALTER TABLE view_blocks
  ADD CONSTRAINT view_blocks_width_check 
  CHECK (width > 0),
  ADD CONSTRAINT view_blocks_height_check 
  CHECK (height > 0),
  ADD CONSTRAINT view_blocks_position_x_check 
  CHECK (position_x >= 0),
  ADD CONSTRAINT view_blocks_position_y_check 
  CHECK (position_y >= 0);

-- entity_version_config
ALTER TABLE entity_version_config
  DROP CONSTRAINT IF EXISTS entity_version_config_max_versions_check,
  DROP CONSTRAINT IF EXISTS entity_version_config_auto_save_interval_check;

ALTER TABLE entity_version_config
  ADD CONSTRAINT entity_version_config_max_versions_check 
  CHECK (max_versions > 0),
  ADD CONSTRAINT entity_version_config_auto_save_interval_check 
  CHECK (auto_save_interval_seconds > 0);

-- entity_versions
ALTER TABLE entity_versions
  DROP CONSTRAINT IF EXISTS entity_versions_version_number_check;

ALTER TABLE entity_versions
  ADD CONSTRAINT entity_versions_version_number_check 
  CHECK (version_number > 0);

-- grid_view_settings
ALTER TABLE grid_view_settings
  DROP CONSTRAINT IF EXISTS grid_view_settings_frozen_columns_check;

ALTER TABLE grid_view_settings
  ADD CONSTRAINT grid_view_settings_frozen_columns_check 
  CHECK (frozen_columns >= 0);

-- views - prevent circular reference
ALTER TABLE views
  DROP CONSTRAINT IF EXISTS views_no_self_reference_check;

ALTER TABLE views
  ADD CONSTRAINT views_no_self_reference_check 
  CHECK (id != default_view OR default_view IS NULL);

-- ============================================================================
-- 4. ADD UNIQUE CONSTRAINTS (HIGH PRIORITY)
-- ============================================================================

-- interface_pages - prevent duplicate page names in same group
CREATE UNIQUE INDEX IF NOT EXISTS idx_interface_pages_group_name 
ON interface_pages(group_id, name) 
WHERE NOT is_archived;

-- views - prevent duplicate view names in same table
CREATE UNIQUE INDEX IF NOT EXISTS idx_views_table_name 
ON views(table_id, name) 
WHERE table_id IS NOT NULL AND NOT is_archived;

-- views - prevent duplicate view names in same group
CREATE UNIQUE INDEX IF NOT EXISTS idx_views_group_name 
ON views(group_id, name) 
WHERE group_id IS NOT NULL AND NOT is_archived;

-- interface_groups - prevent duplicate group names in same workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_interface_groups_workspace_name 
ON interface_groups(workspace_id, name) 
WHERE workspace_id IS NOT NULL AND NOT is_archived;

-- sidebar_items - prevent duplicate items in same category
CREATE UNIQUE INDEX IF NOT EXISTS idx_sidebar_items_category_href 
ON sidebar_items(category_id, href) 
WHERE category_id IS NOT NULL AND NOT is_archived;

-- ============================================================================
-- 5. ADD UPDATED_AT TRIGGERS (MEDIUM PRIORITY)
-- ============================================================================

-- Create function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables with updated_at
DO $$
DECLARE
  table_name text;
  tables_to_update text[] := ARRAY[
    'automation_logs', 'automation_runs', 'automations',
    'entity_activity_log', 'entity_version_config', 'entity_versions',
    'grid_view_settings', 'interface_categories', 'interface_groups',
    'interface_pages', 'interface_permissions', 'interface_views',
    'interfaces', 'page_type_templates', 'profiles',
    'sidebar_categories', 'sidebar_items', 'table_fields',
    'table_rows', 'tables', 'user_roles', 'view_blocks',
    'view_fields', 'view_filters', 'view_sorts', 'view_tabs',
    'views', 'workspace_settings', 'workspaces'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables_to_update
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%s_updated_at ON %I;
      CREATE TRIGGER update_%s_updated_at 
      BEFORE UPDATE ON %I 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
    ', table_name, table_name, table_name, table_name);
  END LOOP;
END $$;

-- ============================================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON INDEX idx_automation_logs_automation_id IS 'Index on automation_id foreign key for performance';
COMMENT ON INDEX idx_automation_logs_run_id IS 'Index on run_id foreign key for performance';
COMMENT ON INDEX idx_automation_runs_automation_id IS 'Index on automation_id foreign key for performance';
COMMENT ON CONSTRAINT views_no_self_reference_check ON views IS 'Prevents circular reference where view references itself as default_view';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
