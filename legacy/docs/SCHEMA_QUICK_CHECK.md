# Schema Quick Check Analysis

**Date:** 2026-01-25  
**Schema Source:** Database schema dump

## Executive Summary

The schema appears structurally sound with proper foreign key relationships, but several issues were identified that should be addressed:

1. **Duplicate/Versioned Tables** - Multiple versions of the same logical tables exist
2. **Missing Foreign Keys** - Some relationships lack explicit foreign key constraints
3. **Inconsistent Data Types** - Mix of `ARRAY` (untyped) and `jsonb` for similar data
4. **Column Naming Issues** - Some columns start with numbers (invalid in some contexts)
5. **Missing NOT NULL Constraints** - Some critical fields allow NULL values

---

## Deprecated / unused tables

- **`page_blocks`** — Unused. Block storage uses **`view_blocks`** only. No application code reads or writes `page_blocks`. Do not use for new features. See [BLOCK_SYSTEM_CANONICAL.md](architecture/BLOCK_SYSTEM_CANONICAL.md) (Block System: Canonical Definition and Consumer Paths).

---

## 1. Duplicate/Versioned Tables ⚠️

The schema contains multiple versions of the same logical tables, suggesting migrations or table recreations:

### Briefings Tables
- `table_briefings_1766847886126` (older version - missing audit fields)
- `table_briefings_1768073365356` (newer version - has `created_by`, `updated_by`)

**Issue:** The older version lacks:
- `created_by` and `updated_by` foreign keys
- Proper default values for audit fields

**Recommendation:** 
- Archive or drop `table_briefings_1766847886126` if no longer in use
- Migrate any remaining data to the newer version
- Update application code to reference only the current version

### Campaigns Tables
- `table_campaigns_1766847958019` (older - missing audit fields)
- `table_campaigns_1768074134170` (newer - has audit fields)

**Issue:** Same as briefings - older version lacks audit trail.

### Contacts Tables
- `table_contacts_1766847128905` (older - missing audit fields)
- `table_contact_1768073851531` (newer - has audit fields, note: singular "contact")

**Issue:** 
- Naming inconsistency (plural vs singular)
- Older version lacks audit fields

### Content Tables
- `table_content_1767726395418` (older - different field types)
- `table_content_1768242820540` (newer - has `images` as `jsonb`, additional fields)

**Issue:** 
- Field type changes (`images` changed from `text` to `jsonb`)
- Additional fields in newer version (`dates`, `city`, `venue`, `country`, `quarterly_theme`, `post_originator_approve`)

### Sponsorships Tables
- `table_sponsorships_1766847842576` (older - missing audit fields)
- `table_sponsorships_1768074191424` (newer - has audit fields)

**Issue:** Same pattern - older version lacks audit trail.

---

## 2. Missing Foreign Key Constraints ⚠️

Several relationships exist in the data model but lack explicit foreign key constraints:

### In `table_content_1768242820540`:
```sql
quarterly_theme uuid  -- References table_quarterly_themes_1768568434852(id) but no FK
post_originator_approve uuid  -- No FK defined
```

### In `table_events_1768569094201`:
```sql
linked_theme uuid  -- References table_quarterly_themes_1768568434852(id) but no FK
location uuid  -- References table_locations_1768568830022(id) but no FK
before_content uuid  -- References table_content_1768242820540(id) but no FK
during_content uuid  -- References table_content_1768242820540(id) but no FK
after_content uuid  -- References table_content_1768242820540(id) but no FK
sponsorship uuid  -- References table_sponsorships_1768074191424(id) but no FK
```

### In `table_locations_1768568830022`:
```sql
preferred_spokespeople uuid  -- No FK defined (possibly references contacts?)
```

### In `table_quarterly_themes_1768568434852`:
```sql
location_spotlight uuid  -- References table_locations_1768568830022(id) but no FK
themes uuid  -- Self-reference? No FK defined
```

### In `table_tasks_1768655456178`:
```sql
allocated_to uuid  -- References auth.users(id)? No FK
content uuid  -- References table_content_1768242820540(id) but no FK
theme uuid  -- References table_quarterly_themes_1768568434852(id) but no FK
events uuid  -- References table_events_1768569094201(id) but no FK
sponsorships uuid  -- References table_sponsorships_1768074191424(id) but no FK
```

### In `table_theme_division_matrix_1768568646216`:
```sql
core_theme uuid  -- References table_quarterly_themes_1768568434852(id) but no FK
```

**Recommendation:** Add foreign key constraints to ensure referential integrity and enable CASCADE behaviors.

---

## 3. Inconsistent Data Types ⚠️

### Untyped ARRAY vs jsonb

Several tables use untyped `ARRAY` columns:
- `table_briefings_1768073365356.key_messages` - `ARRAY` (should be `text[]` or `jsonb`)
- `table_briefings_1768073365356.whats_the_story` - `ARRAY` (should be `text[]` or `jsonb`)
- `table_briefings_1768073365356.approval_process` - `ARRAY` (should be `text[]` or `jsonb`)
- `table_briefings_1768073365356.notes` - `ARRAY` (should be `text[]` or `jsonb`)
- `table_campaigns_1768074134170.notes` - `ARRAY` (should be `text[]` or `jsonb`)
- `table_campaigns_1768074134170.content` - `ARRAY` (should be `text[]` or `jsonb`)
- `table_campaigns_1768074134170.content_calendar_from_sponsorships` - `ARRAY` (should be `text[]` or `jsonb`)
- `table_contact_1768073851531.social_media_posts` - `ARRAY` (should be `text[]` or `jsonb`)
- `table_contact_1768073851531.pr_tracker` - `ARRAY` (should be `text[]` or `jsonb`)
- `table_content_1768242820540.channels` - `ARRAY` (should be `text[]` or `jsonb`)
- `table_events_1768569094201.event_type` - `ARRAY` (should be `text[]` or `jsonb`)
- `table_locations_1768568830022.key_strengths` - `ARRAY` (should be `text[]` or `jsonb`)
- `table_quarterly_themes_1768568434852.lead_divisions` - `ARRAY` (should be `text[]` or `jsonb`)
- `table_sponsorships_1768074191424.marketing_resources` - `ARRAY` (should be `text[]` or `jsonb`)
- `table_sponsorships_1768074191424.documents` - `ARRAY` (should be `text[]` or `jsonb`)
- `table_sponsorships_1768074191424.content_calendar` - `ARRAY` (should be `text[]` or `jsonb`)
- `table_tasks_1768655456178.divisions` - `ARRAY` (should be `text[]` or `jsonb`)
- `table_theme_division_matrix_1768568646216.typical_content_types` - `ARRAY` (should be `text[]` or `jsonb`)

**Issue:** Untyped `ARRAY` is ambiguous and may cause type inference issues. PostgreSQL prefers explicit types like `text[]` or `jsonb`.

**Recommendation:** 
- Standardize on either `text[]` for simple string arrays or `jsonb` for complex nested data
- `jsonb` is more flexible and allows for schema evolution
- Consider `jsonb` if arrays may contain objects in the future

---

## 4. Column Naming Issues ⚠️

### Columns Starting with Numbers

In `table_briefings_1768073365356`:
```sql
3rd_party_spokesperson_quote_if_applicable text
```

**Issue:** Column names starting with numbers are invalid in SQL and require quoting in all queries.

**Recommendation:** Rename to:
- `third_party_spokesperson_quote_if_applicable` or
- `third_party_spokesperson_quote` (if the "if_applicable" is redundant)

---

## 5. Missing NOT NULL Constraints ⚠️

Several fields that logically should not be NULL lack NOT NULL constraints:

### In `automations`:
```sql
trigger_type text  -- Should probably be NOT NULL if trigger is required
table_id uuid  -- Should be NOT NULL if trigger_type requires it
```

### In `interface_pages`:
```sql
group_id uuid CHECK (group_id IS NOT NULL)  -- Has CHECK but not NOT NULL
```
**Note:** The CHECK constraint enforces NOT NULL, but it's better to use `NOT NULL` directly for clarity and index optimization.

### In `workspace_settings`:
```sql
workspace_id uuid UNIQUE  -- Should probably be NOT NULL
```

### In `views`:
```sql
table_id uuid  -- Should probably be NOT NULL for most view types
```

---

## 6. Potential Data Integrity Issues ⚠️

### Self-Referencing Foreign Key

In `views`:
```sql
default_view uuid,
CONSTRAINT views_default_view_fkey FOREIGN KEY (default_view) REFERENCES public.views(id)
```

**Issue:** No constraint prevents circular references (A.default_view = B.id AND B.default_view = A.id).

**Recommendation:** Add a CHECK constraint or application-level validation to prevent cycles.

### Orphaned Records Risk

Many foreign keys lack `ON DELETE` clauses:
- Most foreign keys don't specify `ON DELETE CASCADE` or `ON DELETE SET NULL`
- This could lead to orphaned records or deletion failures

**Recommendation:** Review and add appropriate `ON DELETE` behaviors:
- `CASCADE` for dependent data (e.g., `view_fields` when `views` is deleted)
- `SET NULL` for optional relationships (e.g., `views.default_view`)
- `RESTRICT` for critical relationships that should prevent deletion

---

## 7. Index Recommendations 📊

### Missing Indexes for Foreign Keys

While PostgreSQL automatically creates indexes for PRIMARY KEYs, foreign keys don't automatically get indexes. Consider adding indexes for frequently queried foreign keys:

```sql
-- High-traffic foreign keys that likely need indexes:
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_run_id ON automation_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_id ON automation_runs(automation_id);
CREATE INDEX IF NOT EXISTS idx_entity_activity_log_entity ON entity_activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_entity ON favorites(user_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_recent_items_user_entity ON recent_items(user_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_table_rows_table_id ON table_rows(table_id);
CREATE INDEX IF NOT EXISTS idx_view_blocks_view_id ON view_blocks(view_id);
CREATE INDEX IF NOT EXISTS idx_view_blocks_page_id ON view_blocks(page_id);
```

---

## 8. Check Constraint Issues ⚠️

### In `grid_view_settings`:
```sql
row_height text DEFAULT 'standard'::text CHECK (row_height = ANY (ARRAY['compact'::text, 'standard'::text, 'large'::text, 'extra_large'::text, 'short'::text, 'medium'::text, 'tall'::text, 'comfortable'::text]))
```

**Issue:** The CHECK constraint includes both old values (`short`, `medium`, `tall`, `comfortable`) and new values (`compact`, `standard`, `large`, `extra_large`). This suggests a migration in progress.

**Recommendation:** 
- Standardize on one set of values
- Migrate existing data to the new values
- Remove deprecated values from the constraint

---

## 9. Status Field Inconsistencies ⚠️

Most tables have a `status` field with default `'draft'::text`, but:
- `entity_version_config` has `status text DEFAULT 'draft'::text` but no CHECK constraint
- `automations` has `status` with CHECK constraint for `'active'` and `'paused'` (different values!)
- `automation_runs` has `status` with CHECK constraint for `'running'`, `'completed'`, `'failed'`, `'stopped'` (different values!)

**Issue:** Inconsistent status values across tables make it difficult to query "all active items" across entity types.

**Recommendation:** 
- Consider standardizing status values across all tables
- Or document that different entity types use different status values
- Add CHECK constraints to all status fields for data integrity

---

## 10. Archive Pattern Inconsistency ⚠️

All tables have `is_archived` and `archived_at` fields, but:
- Some tables set `is_archived` on update, others don't
- No consistent trigger to set `archived_at` when `is_archived` becomes true

**Recommendation:** 
- Create a consistent trigger pattern for archive operations
- Or use application-level logic consistently

---

## Summary of Critical Issues

### High Priority 🔴
1. **Duplicate tables** - Clean up old versions to avoid confusion and data inconsistency
2. **Missing foreign keys** - Add FKs for data integrity, especially in content/events relationships
3. **Column name starting with number** - Rename `3rd_party_spokesperson_quote_if_applicable`

### Medium Priority 🟡
4. **Untyped ARRAY columns** - Standardize on `text[]` or `jsonb`
5. **Missing indexes** - Add indexes for frequently queried foreign keys
6. **Missing ON DELETE behaviors** - Define cascade/set null behaviors

### Low Priority 🟢
7. **Status field inconsistencies** - Document or standardize
8. **Archive pattern** - Standardize archive trigger logic
9. **CHECK vs NOT NULL** - Use NOT NULL where CHECK enforces it

---

## Recommended Actions

1. **Immediate:**
   - Document which table versions are active vs deprecated
   - Add foreign key constraints for all UUID relationships
   - Rename column starting with number

2. **Short-term:**
   - Migrate data from old table versions to new ones
   - Drop deprecated table versions
   - Add missing indexes

3. **Long-term:**
   - Standardize data types (ARRAY vs jsonb)
   - Standardize status values or document differences
   - Implement consistent archive triggers

---

## Notes

- The schema appears to be from a Supabase/PostgreSQL database
- Many tables follow a consistent pattern with audit fields (`created_at`, `updated_at`, `created_by`, `updated_by`)
- The dynamic table system (`table_*` tables) suggests a flexible schema-on-read approach
- RLS (Row Level Security) policies are not shown in this schema dump but likely exist in migrations
