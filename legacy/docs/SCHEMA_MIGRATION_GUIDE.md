# Schema Integrity Migration Guide

**Date:** 2026-01-25  
**Migration File:** `supabase/migrations/fix_schema_integrity_issues.sql`

## Overview

This migration addresses critical schema integrity issues identified in the schema quick check.

**Note:** The table `page_blocks` is unused; block storage uses `view_blocks` only. See [BLOCK_SYSTEM_CANONICAL.md](architecture/BLOCK_SYSTEM_CANONICAL.md). Do not add new references to `page_blocks`. It is designed to be run safely in a transaction with rollback capability.

## What This Migration Does

### 1. Column Renaming ✅
- Renames `3rd_party_spokesperson_quote_if_applicable` to `third_party_spokesperson_quote_if_applicable`
- **Impact:** Low - only affects one column in one table
- **Breaking Change:** Yes - application code using the old column name will need updates

### 2. Foreign Key Constraints ✅
Adds missing foreign key constraints to ensure referential integrity:
- `table_content_1768242820540.quarterly_theme` → `table_quarterly_themes_1768568434852`
- `table_events_1768569094201` → Multiple relationships (themes, locations, content, sponsorships)
- `table_tasks_1768655456178` → Multiple relationships (users, content, themes, events, sponsorships)
- `table_quarterly_themes_1768568434852` → Self-reference and location relationships
- `table_theme_division_matrix_1768568646216` → Theme relationships

**Impact:** Medium - ensures data integrity, may fail if orphaned records exist

### 3. Index Creation ✅
Creates indexes on foreign key columns for better query performance:
- Automation tables
- Entity activity logs
- Favorites and recent items
- View blocks and related tables
- Dynamic content table foreign keys

**Impact:** Low - improves performance, minimal risk

### 4. ON DELETE Behaviors ✅
Updates existing foreign keys to have appropriate cascade behaviors:
- `automation_logs` → CASCADE when automation deleted
- `automation_runs` → CASCADE when automation deleted
- `view_blocks`, `view_fields`, `view_filters`, `view_sorts` → CASCADE when view deleted
- `views.default_view` → SET NULL when referenced view deleted

**Impact:** Medium - changes deletion behavior (orphaned records will be cleaned up)

### 5. ARRAY Type Conversion ✅
Converts untyped `ARRAY` columns to `text[]`:
- Briefings, campaigns, contacts, content, events, locations, themes, sponsorships, tasks, theme division matrix

**Impact:** Medium - data type change, should be transparent but test carefully

### 6. NOT NULL Constraints ✅
Adds NOT NULL constraints where logically required:
- `interface_pages.group_id`
- `workspace_settings.workspace_id`

**Impact:** Medium - may fail if NULL values exist (migration handles this)

### 7. Circular Reference Prevention ✅
Adds trigger to prevent circular references in `views.default_view`

**Impact:** Low - prevents data integrity issues

## Pre-Migration Checklist

Before running this migration:

- [ ] **Backup your database** - Always backup before schema changes
- [ ] **Test in development/staging first** - Never run on production first
- [ ] **Check for orphaned records** - Run the queries below to identify issues
- [ ] **Update application code** - Column rename will break queries using old name
- [ ] **Schedule maintenance window** - Some operations may lock tables briefly

## Pre-Migration Validation Queries

Run these queries to check for potential issues:

### Check for orphaned records that would break FK constraints:

```sql
-- Check quarterly_theme references
SELECT COUNT(*) as orphaned_themes
FROM table_content_1768242820540 c
WHERE c.quarterly_theme IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM table_quarterly_themes_1768568434852 t 
    WHERE t.id = c.quarterly_theme
);

-- Check event location references
SELECT COUNT(*) as orphaned_locations
FROM table_events_1768569094201 e
WHERE e.location IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM table_locations_1768568830022 l 
    WHERE l.id = e.location
);

-- Check task content references
SELECT COUNT(*) as orphaned_content
FROM table_tasks_1768655456178 t
WHERE t.content IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM table_content_1768242820540 c 
    WHERE c.id = t.content
);
```

### Check for NULL values in columns that will become NOT NULL:

```sql
-- Check interface_pages.group_id
SELECT COUNT(*) as null_group_ids
FROM interface_pages
WHERE group_id IS NULL;

-- Check workspace_settings.workspace_id
SELECT COUNT(*) as null_workspace_ids
FROM workspace_settings
WHERE workspace_id IS NULL;
```

## Running the Migration

### Option 1: Full Migration (Recommended for first run)

```bash
# Using Supabase CLI
supabase db reset  # In development
# OR
supabase migration up

# Or run directly in psql
psql -h your-db-host -U postgres -d your-db -f supabase/migrations/fix_schema_integrity_issues.sql
```

### Option 2: Section-by-Section (For troubleshooting)

The migration is organized into sections. You can comment out sections you want to skip and run incrementally.

## Post-Migration Verification

Run the verification script:

```bash
psql -h your-db-host -U postgres -d your-db -f supabase/migrations/verify_schema_fixes.sql
```

This will check:
- ✅ Column rename success
- ✅ Foreign keys created
- ✅ Indexes created
- ✅ ARRAY type conversions
- ✅ NOT NULL constraints
- ✅ ON DELETE behaviors
- ✅ Circular reference trigger

## Rollback Plan

If you need to rollback, the migration runs in a transaction, so you can:

1. **Before COMMIT:** Simply rollback the transaction
2. **After COMMIT:** Run manual rollback commands (see below)

### Manual Rollback Steps

```sql
BEGIN;

-- 1. Remove foreign keys (if needed)
ALTER TABLE table_content_1768242820540 
DROP CONSTRAINT IF EXISTS table_content_quarterly_theme_fkey;

-- 2. Remove indexes (optional - they don't hurt)
DROP INDEX IF EXISTS idx_table_content_quarterly_theme;

-- 3. Revert column rename
ALTER TABLE table_briefings_1768073365356
RENAME COLUMN third_party_spokesperson_quote_if_applicable 
TO "3rd_party_spokesperson_quote_if_applicable";

-- 4. Remove trigger
DROP TRIGGER IF EXISTS prevent_view_circular_reference ON views;
DROP FUNCTION IF EXISTS check_view_circular_reference();

-- Note: ARRAY type conversion and NOT NULL constraints are harder to rollback
-- You may need to manually alter columns back

COMMIT;
```

## Application Code Updates Required

### 1. Column Name Change

Update any queries referencing the old column name:

```javascript
// OLD (will break)
SELECT "3rd_party_spokesperson_quote_if_applicable" FROM table_briefings_1768073365356

// NEW
SELECT third_party_spokesperson_quote_if_applicable FROM table_briefings_1768073365356
```

### 2. ARRAY Type Handling

The ARRAY columns are now `text[]` instead of untyped. Most ORMs handle this automatically, but verify:

```javascript
// Should work the same, but verify your ORM handles text[] correctly
const channels = row.channels; // Should be string[]
```

## Potential Issues and Solutions

### Issue: Migration fails with "violates foreign key constraint"

**Cause:** Orphaned records exist that don't have valid references.

**Solution:**
1. Run the pre-migration validation queries above
2. Clean up orphaned records:
   ```sql
   -- Example: Set orphaned references to NULL
   UPDATE table_content_1768242820540
   SET quarterly_theme = NULL
   WHERE quarterly_theme IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM table_quarterly_themes_1768568434852 t 
       WHERE t.id = quarterly_theme
   );
   ```
3. Re-run migration

### Issue: NOT NULL constraint fails

**Cause:** NULL values exist in columns that will become NOT NULL.

**Solution:** The migration handles this automatically by setting default values, but if it fails:
1. Manually update NULL values
2. Re-run migration

### Issue: ARRAY conversion fails

**Cause:** Data in ARRAY columns may not be convertible to text[].

**Solution:**
1. Check data types in ARRAY columns
2. Clean invalid data
3. Re-run migration

## Performance Considerations

- **Index creation:** May take time on large tables. Consider creating indexes concurrently in production:
  ```sql
  CREATE INDEX CONCURRENTLY idx_name ON table_name(column_name);
  ```
- **Foreign key validation:** PostgreSQL validates all existing data when adding FKs. This can be slow on large tables.
- **ARRAY conversion:** Type conversion requires a table rewrite, which can lock the table briefly.

## Next Steps After Migration

1. ✅ Run verification script
2. ✅ Update application code for column rename
3. ✅ Test application functionality
4. ✅ Monitor for any performance issues
5. ✅ Consider cleaning up deprecated tables (see SCHEMA_QUICK_CHECK.md)

## Related Documentation

- `docs/SCHEMA_QUICK_CHECK.md` - Original analysis of schema issues
- `supabase/migrations/verify_schema_fixes.sql` - Verification script

## Support

If you encounter issues:
1. Check the verification script output
2. Review PostgreSQL logs for detailed error messages
3. Check for orphaned records using pre-migration queries
4. Consider running sections individually to isolate issues
