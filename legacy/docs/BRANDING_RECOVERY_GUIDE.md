# Branding Settings Recovery Guide

**Issue:** Branding settings were lost during the `fix_schema_integrity_issues.sql` migration.

## What Happened

The migration deleted `workspace_settings` rows that had `NULL` values in the `workspace_id` column when the column type is `uuid`. This was an overly aggressive cleanup that shouldn't have deleted valid settings.

## Recovery Options

### Option 1: Run Recovery Script (Quick Fix)

Run the recovery script to create default branding settings:

```bash
psql -h your-db-host -U postgres -d your-db -f supabase/migrations/recover_branding_settings.sql
```

This will:
- Check if settings exist
- Create default branding settings if missing
- Provide guidance on manual recovery

### Option 2: Restore from Backup

If you have a database backup from before the migration:

1. **Supabase Point-in-Time Recovery:**
   - Go to Supabase Dashboard → Database → Backups
   - Find a backup from before the migration
   - Restore the `workspace_settings` table

2. **Manual Backup Restore:**
   ```sql
   -- If you have a backup file
   pg_restore -d your-database backup_file.dump
   ```

### Option 3: Manual Recovery (If You Remember Settings)

If you remember your branding values, insert them manually:

```sql
-- First, get your workspace ID
SELECT id FROM workspaces LIMIT 1;

-- Then insert your settings (replace values with your actual branding)
INSERT INTO public.workspace_settings (
    workspace_id,
    brand_name,
    logo_url,
    primary_color,
    accent_color,
    sidebar_color,
    sidebar_text_color
) VALUES (
    'your-workspace-uuid-here'::uuid,  -- Use the UUID from above
    'Your Brand Name',
    'https://your-logo-url.com/logo.png',
    'hsl(222.2, 47.4%, 11.2%)',  -- Your primary color
    'hsl(210, 40%, 96.1%)',      -- Your accent color
    '#ffffff',                   -- Your sidebar color
    '#4b5563'                    -- Your sidebar text color
)
ON CONFLICT (workspace_id) DO UPDATE SET
    brand_name = EXCLUDED.brand_name,
    logo_url = EXCLUDED.logo_url,
    primary_color = EXCLUDED.primary_color,
    accent_color = EXCLUDED.accent_color,
    sidebar_color = EXCLUDED.sidebar_color,
    sidebar_text_color = EXCLUDED.sidebar_text_color,
    updated_at = NOW();
```

### Option 4: Check Application Cache/Browser Storage

Your branding settings might be cached:
- Check browser localStorage
- Check application logs
- Check if you have any screenshots with the branding visible

### Option 5: Check Database Logs

If you have access to PostgreSQL logs, you might be able to see the deleted values:

```sql
-- Check if you have logical replication or WAL archiving enabled
-- This is advanced and may not be available
```

## Prevention for Future

The migration has been updated to be safer, but for future migrations:

1. **Always backup before running migrations**
2. **Test migrations in development first**
3. **Review migration scripts for destructive operations**

## Fix Applied

The migration logic has been updated to be less aggressive. Instead of deleting rows with NULL `workspace_id`, it now:
- For text type: Sets NULL values to 'default'
- For uuid type: **Warns instead of deleting** (safer approach)

## Need Help?

If you can't recover your settings:
1. Run the recovery script to get default branding
2. Re-enter your branding through the Settings → Branding tab
3. Consider setting up automated backups for `workspace_settings`

## Related Files

- `supabase/migrations/recover_branding_settings.sql` - Recovery script
- `supabase/migrations/fix_schema_integrity_issues.sql` - Original migration (now safer)
