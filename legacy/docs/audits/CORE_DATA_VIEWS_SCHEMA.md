# Core Data Views Schema Audit

**Purpose:** Document actual column names, constraints, and migrations for `view_fields`, `view_filters`, and `view_sorts` tables used by Core Data views.

**Reference:** `supabase/schema.sql` (canonical schema), migrations in `supabase/migrations/`.

---

## 1. view_fields

### Purpose

Stores field visibility and ordering per view. Used by grid, kanban, calendar, form, timeline, and gallery views.

### Schema (Current)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NOT NULL | gen_random_uuid() | Primary key |
| view_id | uuid | YES | NULL | FK → views(id) |
| field_name | text | NOT NULL | - | Field name (matches table_fields.name) |
| visible | boolean | - | true | Whether field is visible in view |
| position | integer | - | 0 | Display order |
| created_at | timestamptz | - | now() | Audit |
| updated_at | timestamptz | - | now() | Audit |
| created_by | uuid | YES | NULL | FK → auth.users(id) |
| updated_by | uuid | YES | NULL | FK → auth.users(id) |
| status | text | - | 'draft' | Audit |
| is_archived | boolean | - | false | Audit |
| archived_at | timestamptz | YES | NULL | Audit |

### Constraints

- `view_fields_pkey` PRIMARY KEY (id)
- `view_fields_view_id_fkey` FOREIGN KEY (view_id) REFERENCES views(id)
- `view_fields_created_by_fkey` FOREIGN KEY (created_by) REFERENCES auth.users(id)
- `view_fields_updated_by_fkey` FOREIGN KEY (updated_by) REFERENCES auth.users(id)

### Indexes

- `idx_view_fields_view_id` ON view_fields(view_id) WHERE view_id IS NOT NULL
- `idx_view_fields_created_by` ON view_fields(created_by) WHERE created_by IS NOT NULL
- `idx_view_fields_updated_by` ON view_fields(updated_by) WHERE updated_by IS NOT NULL

### Code Usage

- **field_name**: Used everywhere (not `field_id`). Code references fields by name.
- **visible**: Controls column visibility in grid; card visibility in Kanban/Gallery.
- **position**: Display order for columns and card fields.

### Migrations

- `fix_schema_for_interface_pages.sql`: Adds `visible` column if missing; syncs from `hidden` if present.
- `add_standard_system_fields.sql`: Adds audit columns (created_at, updated_at, created_by, updated_by, status, is_archived, archived_at).
- `standardize_audit_fields_across_data_tables.sql`: Ensures system fields (created_at, created_by, updated_at, updated_by) exist in view_fields with `visible: false`.
- `fix_schema_integrity_issues.sql`: Updates view_id FK with ON DELETE CASCADE.

### Notes

- `field_id` is **not** used. Schema and code use `field_name` exclusively.
- No unique constraint on (view_id, field_name) in some environments; migrations use idempotent checks.
- `initialize-fields` API populates view_fields from table_fields when a view has no fields.

---

## 2. view_filters

### Purpose

Stores filtering rules for views. Supports filter groups (AND/OR logic) via `view_filter_groups`.

### Schema (Current)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NOT NULL | gen_random_uuid() | Primary key |
| view_id | uuid | YES | NULL | FK → views(id) |
| field_name | text | YES | NULL | Field to filter on |
| operator | text | YES | NULL | Filter operator (e.g. is, contains, is_empty) |
| value | text | YES | NULL | Filter value |
| filter_group_id | uuid | YES | NULL | FK → view_filter_groups(id) |
| order_index | integer | NOT NULL | 0 | Order within group |
| created_at | timestamptz | - | now() | Audit |
| updated_at | timestamptz | - | now() | Audit |
| created_by | uuid | YES | NULL | FK → auth.users(id) |
| updated_by | uuid | YES | NULL | FK → auth.users(id) |
| status | text | - | 'draft' | Audit |
| is_archived | boolean | - | false | Audit |
| archived_at | timestamptz | YES | NULL | Audit |

### Constraints

- `view_filters_pkey` PRIMARY KEY (id)
- `view_filters_view_id_fkey` FOREIGN KEY (view_id) REFERENCES views(id)
- `view_filters_filter_group_id_fkey` FOREIGN KEY (filter_group_id) REFERENCES view_filter_groups(id)
- `view_filters_created_by_fkey` FOREIGN KEY (created_by) REFERENCES auth.users(id)
- `view_filters_updated_by_fkey` FOREIGN KEY (updated_by) REFERENCES auth.users(id)

### Indexes

- `idx_view_filters_view_id` ON view_filters(view_id)
- `idx_view_filters_filter_group_id` ON view_filters(filter_group_id)
- `idx_view_filters_order_index` ON view_filters(order_index)
- `idx_view_filters_created_by`, `idx_view_filters_updated_by` (where applicable)

### Code Usage

- **field_name**: Used for filter logic (not `field_id`).
- **filter_group_id**: Optional; NULL = filter not in a group (backward compatibility).
- **order_index**: Order within a filter group.

### Migrations

- `add_filter_groups_support.sql`: Adds `filter_group_id` and `order_index`; creates `view_filter_groups` table.
- `add_standard_system_fields.sql`: Adds audit columns.
- `fix_schema_integrity_issues.sql`: Updates view_id FK with ON DELETE CASCADE.

### Related Table: view_filter_groups

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| view_id | uuid | FK → views(id) |
| condition_type | text | 'AND' or 'OR' |
| order_index | integer | Order of groups |

---

## 3. view_sorts

### Purpose

Stores sorting configuration for views.

### Schema (Current)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NOT NULL | gen_random_uuid() | Primary key |
| view_id | uuid | YES | NULL | FK → views(id) |
| field_name | text | NOT NULL | - | Field to sort by |
| direction | text | NOT NULL | - | 'asc' or 'desc' |
| order_index | integer | NOT NULL | 0 | Order of sort rules |
| created_at | timestamptz | - | now() | Audit |
| updated_at | timestamptz | - | now() | Audit |
| created_by | uuid | YES | NULL | FK → auth.users(id) |
| updated_by | uuid | YES | NULL | FK → auth.users(id) |
| status | text | - | 'draft' | Audit |
| is_archived | boolean | - | false | Audit |
| archived_at | timestamptz | YES | NULL | Audit |

### Constraints

- `view_sorts_pkey` PRIMARY KEY (id)
- `view_sorts_view_id_fkey` FOREIGN KEY (view_id) REFERENCES views(id)
- `view_sorts_field_name_check`: direction IN ('asc', 'desc')
- `view_sorts_created_by_fkey`, `view_sorts_updated_by_fkey`

### Indexes

- `idx_view_sorts_order_index` ON view_sorts(view_id, order_index)
- `idx_view_sorts_view_id`, `idx_view_sorts_created_by`, `idx_view_sorts_updated_by`

### Code Usage

- **field_name**: Used for sort logic (not `field_id`).
- **order_index**: Order of sort rules (primary sort first).

### Migrations

- `add_order_index_to_view_sorts.sql`: Adds `order_index` column if missing; backfills from created_at.
- `add_standard_system_fields.sql`: Adds audit columns.
- `fix_schema_integrity_issues.sql`: Updates view_id FK with ON DELETE CASCADE.

---

## 4. Summary

| Table | Field ID vs Name | Key Columns |
|-------|------------------|-------------|
| view_fields | **field_name** only | view_id, field_name, visible, position |
| view_filters | **field_name** only | view_id, field_name, operator, value, filter_group_id, order_index |
| view_sorts | **field_name** only | view_id, field_name, direction, order_index |

All three tables use `field_name` (text) to reference table fields, not `field_id`. The codebase consistently uses `field_name` in queries and TypeScript types.

---

## 5. Gallery View Type

**Conclusion:** Gallery uses a dedicated `GalleryView` component, not `KanbanView`.

- **KanbanView**: Column-based layout; cards grouped by a field into columns.
- **GalleryView**: Grid of cards; optional grouping with collapsible sections.

Core Data gallery views (`/tables/[tableId]/views/[viewId]` with `type: "gallery"`) route through `NonGridViewWrapper` to `GalleryView`. Both Kanban and Gallery share `CustomizeCardsDialog` for card configuration (image field, color field, fields on card, wrap text).
