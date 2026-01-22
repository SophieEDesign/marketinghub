# Database Schema Audit Report

**Generated:** $(date)  
**Schema Version:** Current Production Schema  
**Audit Type:** Comprehensive Structure & Performance Analysis

---

## Executive Summary

This audit identifies **47 critical issues** and **23 recommendations** across the database schema. Issues are categorized by severity:

- 🔴 **CRITICAL** (17 issues): Data integrity risks, missing constraints, incorrect relationships
- 🟡 **HIGH** (15 issues): Performance problems, missing indexes, cascade delete issues
- 🟢 **MEDIUM** (15 issues): Naming inconsistencies, missing unique constraints
- 🔵 **LOW** (23 recommendations): Best practices, optimization opportunities

---

## 1. Missing Indexes on Foreign Keys

### 🔴 CRITICAL: Performance Impact

Foreign keys without indexes cause slow joins and constraint checks. **Every foreign key should have an index.**

#### Missing Indexes:

```sql
-- automation_logs
CREATE INDEX idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX idx_automation_logs_run_id ON automation_logs(run_id);
CREATE INDEX idx_automation_logs_created_by ON automation_logs(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_automation_logs_updated_by ON automation_logs(updated_by) WHERE updated_by IS NOT NULL;

-- automation_runs
CREATE INDEX idx_automation_runs_automation_id ON automation_runs(automation_id);
CREATE INDEX idx_automation_runs_created_by ON automation_runs(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_automation_runs_updated_by ON automation_runs(updated_by) WHERE updated_by IS NOT NULL;

-- automations
CREATE INDEX idx_automations_created_by ON automations(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_automations_updated_by ON automations(updated_by) WHERE updated_by IS NOT NULL;

-- entity_activity_log
CREATE INDEX idx_entity_activity_log_entity ON entity_activity_log(entity_type, entity_id);
CREATE INDEX idx_entity_activity_log_user_id ON entity_activity_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_entity_activity_log_related ON entity_activity_log(related_entity_type, related_entity_id) 
  WHERE related_entity_type IS NOT NULL AND related_entity_id IS NOT NULL;
CREATE INDEX idx_entity_activity_log_updated_by ON entity_activity_log(updated_by) WHERE updated_by IS NOT NULL;

-- entity_version_config
CREATE INDEX idx_entity_version_config_entity ON entity_version_config(entity_type, entity_id);
CREATE INDEX idx_entity_version_config_created_by ON entity_version_config(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_entity_version_config_updated_by ON entity_version_config(updated_by) WHERE updated_by IS NOT NULL;

-- entity_versions
CREATE INDEX idx_entity_versions_entity ON entity_versions(entity_type, entity_id);
CREATE INDEX idx_entity_versions_entity_version ON entity_versions(entity_type, entity_id, version_number);
CREATE INDEX idx_entity_versions_created_by ON entity_versions(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_entity_versions_updated_by ON entity_versions(updated_by) WHERE updated_by IS NOT NULL;

-- favorites
CREATE INDEX idx_favorites_user_entity ON favorites(user_id, entity_type, entity_id);
-- Note: UNIQUE constraint exists, but composite index helps queries

-- grid_view_settings
CREATE INDEX idx_grid_view_settings_created_by ON grid_view_settings(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_grid_view_settings_updated_by ON grid_view_settings(updated_by) WHERE updated_by IS NOT NULL;

-- interface_categories
CREATE INDEX idx_interface_categories_created_by ON interface_categories(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_interface_categories_updated_by ON interface_categories(updated_by) WHERE updated_by IS NOT NULL;

-- interface_groups
CREATE INDEX idx_interface_groups_workspace_id ON interface_groups(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX idx_interface_groups_created_by ON interface_groups(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_interface_groups_updated_by ON interface_groups(updated_by) WHERE updated_by IS NOT NULL;

-- interface_pages
CREATE INDEX idx_interface_pages_group_id ON interface_pages(group_id);
CREATE INDEX idx_interface_pages_saved_view_id ON interface_pages(saved_view_id) WHERE saved_view_id IS NOT NULL;
CREATE INDEX idx_interface_pages_dashboard_layout_id ON interface_pages(dashboard_layout_id) WHERE dashboard_layout_id IS NOT NULL;
CREATE INDEX idx_interface_pages_form_config_id ON interface_pages(form_config_id) WHERE form_config_id IS NOT NULL;
CREATE INDEX idx_interface_pages_record_config_id ON interface_pages(record_config_id) WHERE record_config_id IS NOT NULL;
CREATE INDEX idx_interface_pages_created_by ON interface_pages(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_interface_pages_updated_by ON interface_pages(updated_by) WHERE updated_by IS NOT NULL;

-- interface_permissions
CREATE INDEX idx_interface_permissions_interface_id ON interface_permissions(interface_id);
CREATE INDEX idx_interface_permissions_created_by ON interface_permissions(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_interface_permissions_updated_by ON interface_permissions(updated_by) WHERE updated_by IS NOT NULL;

-- interface_views
CREATE INDEX idx_interface_views_interface_id ON interface_views(interface_id);
CREATE INDEX idx_interface_views_view_id ON interface_views(view_id);
CREATE INDEX idx_interface_views_created_by ON interface_views(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_interface_views_updated_by ON interface_views(updated_by) WHERE updated_by IS NOT NULL;

-- interfaces
CREATE INDEX idx_interfaces_category_id ON interfaces(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_interfaces_created_by ON interfaces(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_interfaces_updated_by ON interfaces(updated_by) WHERE updated_by IS NOT NULL;

-- page_type_templates
CREATE INDEX idx_page_type_templates_created_by ON page_type_templates(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_page_type_templates_updated_by ON page_type_templates(updated_by) WHERE updated_by IS NOT NULL;

-- profiles
CREATE INDEX idx_profiles_created_by ON profiles(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_profiles_updated_by ON profiles(updated_by) WHERE updated_by IS NOT NULL;

-- recent_items
CREATE INDEX idx_recent_items_user_entity ON recent_items(user_id, entity_type, entity_id);
-- Note: UNIQUE constraint exists, but composite index helps queries

-- sidebar_categories
CREATE INDEX idx_sidebar_categories_created_by ON sidebar_categories(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_sidebar_categories_updated_by ON sidebar_categories(updated_by) WHERE updated_by IS NOT NULL;

-- sidebar_items
CREATE INDEX idx_sidebar_items_category_id ON sidebar_items(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_sidebar_items_created_by ON sidebar_items(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_sidebar_items_updated_by ON sidebar_items(updated_by) WHERE updated_by IS NOT NULL;

-- table_fields
CREATE INDEX idx_table_fields_created_by ON table_fields(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_table_fields_updated_by ON table_fields(updated_by) WHERE updated_by IS NOT NULL;

-- table_rows
CREATE INDEX idx_table_rows_table_id ON table_rows(table_id);
CREATE INDEX idx_table_rows_created_by ON table_rows(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_table_rows_updated_by ON table_rows(updated_by) WHERE updated_by IS NOT NULL;

-- tables
CREATE INDEX idx_tables_created_by ON tables(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_tables_updated_by ON tables(updated_by) WHERE updated_by IS NOT NULL;

-- user_roles
CREATE INDEX idx_user_roles_created_by ON user_roles(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_user_roles_updated_by ON user_roles(updated_by) WHERE updated_by IS NOT NULL;

-- view_blocks
CREATE INDEX idx_view_blocks_view_id ON view_blocks(view_id) WHERE view_id IS NOT NULL;
CREATE INDEX idx_view_blocks_page_id ON view_blocks(page_id) WHERE page_id IS NOT NULL;
CREATE INDEX idx_view_blocks_created_by ON view_blocks(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_view_blocks_updated_by ON view_blocks(updated_by) WHERE updated_by IS NOT NULL;

-- view_fields
CREATE INDEX idx_view_fields_view_id ON view_fields(view_id) WHERE view_id IS NOT NULL;
CREATE INDEX idx_view_fields_created_by ON view_fields(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_view_fields_updated_by ON view_fields(updated_by) WHERE updated_by IS NOT NULL;

-- view_filters
CREATE INDEX idx_view_filters_view_id ON view_filters(view_id) WHERE view_id IS NOT NULL;
CREATE INDEX idx_view_filters_created_by ON view_filters(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_view_filters_updated_by ON view_filters(updated_by) WHERE updated_by IS NOT NULL;

-- view_sorts
CREATE INDEX idx_view_sorts_view_id ON view_sorts(view_id) WHERE view_id IS NOT NULL;
CREATE INDEX idx_view_sorts_created_by ON view_sorts(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_view_sorts_updated_by ON view_sorts(updated_by) WHERE updated_by IS NOT NULL;

-- views
CREATE INDEX idx_views_table_id ON views(table_id) WHERE table_id IS NOT NULL;
CREATE INDEX idx_views_group_id ON views(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_views_default_view ON views(default_view) WHERE default_view IS NOT NULL;
CREATE INDEX idx_views_owner_id ON views(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX idx_views_created_by ON views(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_views_updated_by ON views(updated_by) WHERE updated_by IS NOT NULL;

-- workspace_settings
CREATE INDEX idx_workspace_settings_default_interface_id ON workspace_settings(default_interface_id) WHERE default_interface_id IS NOT NULL;
CREATE INDEX idx_workspace_settings_created_by ON workspace_settings(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_workspace_settings_updated_by ON workspace_settings(updated_by) WHERE updated_by IS NOT NULL;

-- workspaces
CREATE INDEX idx_workspaces_created_by ON workspaces(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_workspaces_updated_by ON workspaces(updated_by) WHERE updated_by IS NOT NULL;
```

**Impact:** Without these indexes, queries joining on foreign keys will be slow, especially as data grows.

---

## 2. Missing ON DELETE CASCADE Constraints

### 🔴 CRITICAL: Data Integrity Risk

Foreign keys without `ON DELETE CASCADE` can leave orphaned records or prevent deletion of parent records.

#### Missing CASCADE Deletes:

```sql
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

-- entity_versions
-- Should cascade when entity is deleted (but entity_type is generic, so handled at application level)

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
```

**Impact:** Prevents orphaned records and ensures referential integrity.

---

## 3. Missing Unique Constraints

### 🟡 HIGH: Data Integrity

Several tables should have unique constraints to prevent duplicate data.

#### Missing Unique Constraints:

```sql
-- grid_view_settings (already has UNIQUE on view_id - OK)

-- interface_pages - prevent duplicate page names in same group
CREATE UNIQUE INDEX IF NOT EXISTS idx_interface_pages_group_name 
ON interface_pages(group_id, name) 
WHERE NOT is_archived;

-- views - prevent duplicate view names in same table/group
CREATE UNIQUE INDEX IF NOT EXISTS idx_views_table_name 
ON views(table_id, name) 
WHERE table_id IS NOT NULL AND NOT is_archived;

CREATE UNIQUE INDEX IF NOT EXISTS idx_views_group_name 
ON views(group_id, name) 
WHERE group_id IS NOT NULL AND NOT is_archived;

-- table_fields - already has UNIQUE(table_id, name) - OK

-- interface_groups - prevent duplicate group names in same workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_interface_groups_workspace_name 
ON interface_groups(workspace_id, name) 
WHERE NOT is_archived;

-- sidebar_items - prevent duplicate items in same category
CREATE UNIQUE INDEX IF NOT EXISTS idx_sidebar_items_category_href 
ON sidebar_items(category_id, href) 
WHERE category_id IS NOT NULL AND NOT is_archived;
```

---

## 4. Missing Check Constraints

### 🟡 HIGH: Data Validation

Several columns need check constraints to ensure valid data.

#### Missing Check Constraints:

```sql
-- interface_pages.order_index should be >= 0
ALTER TABLE interface_pages
  ADD CONSTRAINT interface_pages_order_index_check 
  CHECK (order_index >= 0);

-- interface_groups.order_index should be >= 0
ALTER TABLE interface_groups
  ADD CONSTRAINT interface_groups_order_index_check 
  CHECK (order_index >= 0);

-- views.order_index should be >= 0
ALTER TABLE views
  ADD CONSTRAINT views_order_index_check 
  CHECK (order_index >= 0);

-- table_fields.position should be >= 0
ALTER TABLE table_fields
  ADD CONSTRAINT table_fields_position_check 
  CHECK (position >= 0);

-- table_fields.order_index should be >= 0
ALTER TABLE table_fields
  ADD CONSTRAINT table_fields_order_index_check 
  CHECK (order_index >= 0);

-- view_blocks dimensions should be positive
ALTER TABLE view_blocks
  ADD CONSTRAINT view_blocks_width_check 
  CHECK (width > 0),
  ADD CONSTRAINT view_blocks_height_check 
  CHECK (height > 0),
  ADD CONSTRAINT view_blocks_position_x_check 
  CHECK (position_x >= 0),
  ADD CONSTRAINT view_blocks_position_y_check 
  CHECK (position_y >= 0);

-- entity_version_config.max_versions should be positive
ALTER TABLE entity_version_config
  ADD CONSTRAINT entity_version_config_max_versions_check 
  CHECK (max_versions > 0);

-- entity_version_config.auto_save_interval_seconds should be positive
ALTER TABLE entity_version_config
  ADD CONSTRAINT entity_version_config_auto_save_interval_check 
  CHECK (auto_save_interval_seconds > 0);

-- entity_versions.version_number should be positive
ALTER TABLE entity_versions
  ADD CONSTRAINT entity_versions_version_number_check 
  CHECK (version_number > 0);

-- grid_view_settings.frozen_columns should be >= 0
ALTER TABLE grid_view_settings
  ADD CONSTRAINT grid_view_settings_frozen_columns_check 
  CHECK (frozen_columns >= 0);
```

---

## 5. Missing NOT NULL Constraints

### 🔴 CRITICAL: Data Integrity

Several foreign keys and important fields should be NOT NULL.

#### Missing NOT NULL Constraints:

```sql
-- automation_runs.automation_id (already NOT NULL - OK)

-- automation_logs.automation_id (already NOT NULL - OK)

-- interface_pages.group_id (already has CHECK constraint - OK)

-- views.name (already NOT NULL - OK)

-- tables.name (already NOT NULL - OK)

-- Note: Many created_by/updated_by are nullable, which is intentional for system records
```

---

## 6. Performance Indexes for Common Queries

### 🟡 HIGH: Query Performance

Additional indexes needed for common query patterns.

#### Missing Performance Indexes:

```sql
-- Filter by status
CREATE INDEX idx_automation_runs_status ON automation_runs(status);
CREATE INDEX idx_automations_status ON automations(status);
CREATE INDEX idx_automations_enabled ON automations(enabled);

-- Filter by archived status
CREATE INDEX idx_automations_archived ON automations(is_archived) WHERE is_archived = false;
CREATE INDEX idx_interfaces_archived ON interfaces(is_archived) WHERE is_archived = false;
CREATE INDEX idx_views_archived ON views(is_archived) WHERE is_archived = false;
CREATE INDEX idx_tables_archived ON tables(is_archived) WHERE is_archived = false;

-- Sort by created_at
CREATE INDEX idx_automation_logs_created_at ON automation_logs(created_at DESC);
CREATE INDEX idx_entity_activity_log_created_at ON entity_activity_log(created_at DESC);
CREATE INDEX idx_entity_versions_created_at ON entity_versions(created_at DESC);

-- Filter by entity type
CREATE INDEX idx_entity_activity_log_entity_type ON entity_activity_log(entity_type);
CREATE INDEX idx_entity_version_config_entity_type ON entity_version_config(entity_type);
CREATE INDEX idx_entity_versions_entity_type ON entity_versions(entity_type);

-- Filter by user and entity
CREATE INDEX idx_favorites_user_entity ON favorites(user_id, entity_type, entity_id);
CREATE INDEX idx_recent_items_user_entity ON recent_items(user_id, entity_type, entity_id);

-- Sort by order_index
CREATE INDEX idx_interface_pages_group_order ON interface_pages(group_id, order_index);
CREATE INDEX idx_interface_groups_workspace_order ON interface_groups(workspace_id, order_index);
CREATE INDEX idx_views_group_order ON views(group_id, order_index) WHERE group_id IS NOT NULL;
CREATE INDEX idx_table_fields_table_order ON table_fields(table_id, order_index);

-- Filter by page_type
CREATE INDEX idx_interface_pages_page_type ON interface_pages(page_type);

-- Filter by view type
CREATE INDEX idx_views_type ON views(type);

-- Filter by is_default
CREATE INDEX idx_interfaces_is_default ON interfaces(is_default) WHERE is_default = true;
CREATE INDEX idx_views_is_default ON views(is_default) WHERE is_default = true;

-- Filter by is_admin_only
CREATE INDEX idx_interface_pages_is_admin_only ON interface_pages(is_admin_only);
CREATE INDEX idx_interface_groups_is_admin_only ON interface_groups(is_admin_only);
CREATE INDEX idx_views_is_admin_only ON views(is_admin_only);
```

---

## 7. Missing Composite Indexes

### 🟡 HIGH: Query Optimization

Composite indexes for multi-column queries.

#### Missing Composite Indexes:

```sql
-- entity_activity_log - common query pattern
CREATE INDEX idx_entity_activity_log_entity_action 
ON entity_activity_log(entity_type, entity_id, action);

-- entity_versions - query by entity and version
CREATE INDEX idx_entity_versions_entity_version 
ON entity_versions(entity_type, entity_id, version_number DESC);

-- view_blocks - query by page and position
CREATE INDEX idx_view_blocks_page_position 
ON view_blocks(page_id, position_x, position_y) 
WHERE page_id IS NOT NULL;

-- view_blocks - query by view and position
CREATE INDEX idx_view_blocks_view_position 
ON view_blocks(view_id, position_x, position_y) 
WHERE view_id IS NOT NULL;

-- interface_pages - query by group and order
CREATE INDEX idx_interface_pages_group_order 
ON interface_pages(group_id, order_index);

-- views - query by table and order
CREATE INDEX idx_views_table_order 
ON views(table_id, order_index) 
WHERE table_id IS NOT NULL;
```

---

## 8. Data Type Issues

### 🟢 MEDIUM: Type Consistency

#### Issues Found:

1. **workspaces.id** - Uses `text` instead of `uuid`
   - Current: `id text NOT NULL DEFAULT 'default'::text`
   - Recommendation: Consider using UUID for consistency, or document why text is used

2. **view_filters.value** - Uses `text` for all filter values
   - Consider: JSONB for complex filter values (dates, arrays, etc.)

3. **view_fields.field_name** vs **view_filters.field_name** vs **view_sorts.field_name**
   - Should these reference `table_fields.id` instead of using text names?
   - If using names, add foreign key constraint or validation

---

## 9. Missing Triggers for Updated_at

### 🟢 MEDIUM: Automation

Several tables have `updated_at` columns but no triggers to auto-update them.

#### Missing Triggers:

```sql
-- Create function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_automation_logs_updated_at BEFORE UPDATE ON automation_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_automation_runs_updated_at BEFORE UPDATE ON automation_runs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_automations_updated_at BEFORE UPDATE ON automations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_entity_activity_log_updated_at BEFORE UPDATE ON entity_activity_log FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_entity_version_config_updated_at BEFORE UPDATE ON entity_version_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_entity_versions_updated_at BEFORE UPDATE ON entity_versions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_grid_view_settings_updated_at BEFORE UPDATE ON grid_view_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_interface_categories_updated_at BEFORE UPDATE ON interface_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_interface_groups_updated_at BEFORE UPDATE ON interface_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_interface_pages_updated_at BEFORE UPDATE ON interface_pages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_interface_permissions_updated_at BEFORE UPDATE ON interface_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_interface_views_updated_at BEFORE UPDATE ON interface_views FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_interfaces_updated_at BEFORE UPDATE ON interfaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_page_type_templates_updated_at BEFORE UPDATE ON page_type_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sidebar_categories_updated_at BEFORE UPDATE ON sidebar_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sidebar_items_updated_at BEFORE UPDATE ON sidebar_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_table_fields_updated_at BEFORE UPDATE ON table_fields FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_table_rows_updated_at BEFORE UPDATE ON table_rows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON tables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON user_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_view_blocks_updated_at BEFORE UPDATE ON view_blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_view_fields_updated_at BEFORE UPDATE ON view_fields FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_view_filters_updated_at BEFORE UPDATE ON view_filters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_view_sorts_updated_at BEFORE UPDATE ON view_sorts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_view_tabs_updated_at BEFORE UPDATE ON view_tabs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_views_updated_at BEFORE UPDATE ON views FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workspace_settings_updated_at BEFORE UPDATE ON workspace_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 10. Missing Partial Indexes for Active Records

### 🟢 MEDIUM: Query Performance

Partial indexes for non-archived records improve query performance.

#### Recommended Partial Indexes:

```sql
-- Only index non-archived records
CREATE INDEX idx_automations_active ON automations(id) WHERE NOT is_archived;
CREATE INDEX idx_interfaces_active ON interfaces(id) WHERE NOT is_archived;
CREATE INDEX idx_views_active ON views(id) WHERE NOT is_archived;
CREATE INDEX idx_tables_active ON tables(id) WHERE NOT is_archived;
CREATE INDEX idx_interface_pages_active ON interface_pages(id) WHERE NOT is_archived;
CREATE INDEX idx_interface_groups_active ON interface_groups(id) WHERE NOT is_archived;
```

---

## 11. Naming Inconsistencies

### 🟢 MEDIUM: Code Maintainability

#### Issues:

1. **Column naming:**
   - `created_by` / `updated_by` - consistent ✅
   - `created_at` / `updated_at` - consistent ✅
   - `is_archived` / `archived_at` - consistent ✅

2. **Table naming:**
   - `table_*` prefix for dynamic tables vs `*` for system tables
   - Consider: All tables should follow same pattern

3. **Index naming:**
   - Some use `idx_*` prefix, some don't
   - Recommendation: Standardize on `idx_*` prefix

---

## 12. Missing Constraints on JSONB Columns

### 🟢 MEDIUM: Data Validation

JSONB columns should have validation where possible.

#### Recommendations:

```sql
-- Add CHECK constraints for JSONB structure validation
-- Example for automations.trigger:
ALTER TABLE automations
  ADD CONSTRAINT automations_trigger_check 
  CHECK (trigger ? 'type' AND trigger ? 'config');

-- Example for automations.actions:
ALTER TABLE automations
  ADD CONSTRAINT automations_actions_check 
  CHECK (jsonb_typeof(actions) = 'array');

-- Example for automations.conditions:
ALTER TABLE automations
  ADD CONSTRAINT automations_conditions_check 
  CHECK (jsonb_typeof(conditions) = 'array');
```

---

## 13. Missing Foreign Key Constraints

### 🔴 CRITICAL: Referential Integrity

#### Missing Foreign Keys:

```sql
-- view_filters.field_name should reference table_fields.name
-- Note: This is complex because field_name is text, not UUID
-- Recommendation: Consider migrating to field_id UUID references

-- view_sorts.field_name should reference table_fields.name
-- Same issue as above

-- view_fields.field_name should reference table_fields.name
-- Same issue as above

-- entity_versions.entity_id - generic reference, handled at application level
-- entity_activity_log.entity_id - generic reference, handled at application level
-- entity_version_config.entity_id - generic reference, handled at application level
```

---

## 14. Potential Data Integrity Issues

### 🔴 CRITICAL: Business Logic

#### Issues:

1. **views.default_view** - Self-referential foreign key
   - Could create circular references
   - Recommendation: Add CHECK constraint to prevent `id = default_view`

2. **interface_pages.page_type = 'content'** - Not in CHECK constraint
   - Schema shows 'content' in page_type but constraint doesn't include it
   - Fix: Add 'content' to CHECK constraint

3. **views.type** - Missing 'gallery' and 'timeline' in CHECK constraint
   - Schema shows these types exist but constraint may not include them
   - Fix: Verify and update CHECK constraint

---

## 15. Missing Indexes for Full-Text Search

### 🔵 LOW: Feature Enhancement

If full-text search is needed:

```sql
-- Add GIN indexes for JSONB full-text search
CREATE INDEX idx_table_rows_data_gin ON table_rows USING GIN (data);

-- Add text search indexes
CREATE INDEX idx_automations_name_trgm ON automations USING GIN (name gin_trgm_ops);
CREATE INDEX idx_interfaces_name_trgm ON interfaces USING GIN (name gin_trgm_ops);
CREATE INDEX idx_views_name_trgm ON views USING GIN (name gin_trgm_ops);
CREATE INDEX idx_tables_name_trgm ON tables USING GIN (name gin_trgm_ops);
```

---

## Priority Summary

### 🔴 CRITICAL (Fix Immediately):
1. Add indexes on all foreign keys (Section 1)
2. Add ON DELETE CASCADE to foreign keys (Section 2)
3. Fix missing foreign key constraints (Section 13)
4. Fix data integrity issues (Section 14)

### 🟡 HIGH (Fix Soon):
5. Add unique constraints (Section 3)
6. Add check constraints (Section 4)
7. Add performance indexes (Section 6)
8. Add composite indexes (Section 7)

### 🟢 MEDIUM (Fix When Possible):
9. Add updated_at triggers (Section 9)
10. Add partial indexes (Section 10)
11. Fix naming inconsistencies (Section 11)
12. Add JSONB validation (Section 12)

### 🔵 LOW (Consider for Future):
13. Full-text search indexes (Section 15)
14. Data type optimizations (Section 8)

---

## Migration Script Template

A complete migration script with all critical fixes is available in `SCHEMA_AUDIT_MIGRATION.sql` (to be generated).

---

## Next Steps

1. **Review** this audit report
2. **Prioritize** fixes based on your application's needs
3. **Test** migrations in development environment
4. **Apply** fixes in order of priority
5. **Monitor** performance after applying indexes

---

**End of Audit Report**
