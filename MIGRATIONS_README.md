# Database Migrations Guide

This document explains which migration files to use and when.

## Dashboard System Migrations

### ✅ **Use This One: `supabase-dashboard-system-complete.sql`**
**Status:** Latest, production-ready  
**When to use:** Setting up dashboard system for the first time or fixing dashboard issues  
**What it does:**
- Creates `dashboards` and `dashboard_blocks` tables
- Sets up indexes, RLS policies, and triggers
- Auto-creates default dashboard
- Includes content validation trigger

### Legacy/Deprecated Files (Don't use unless migrating old data)
- `supabase-dashboard-complete-fix.sql` - Older version, use `supabase-dashboard-system-complete.sql` instead
- `supabase-dashboard-blocks-fix.sql` - Quick fix, superseded by complete migration
- `supabase-dashboard-complete-migration.sql` - Older version
- `supabase-dashboard-modules-migration.sql` - For old dashboard_modules system

## Complete System Migration

### `supabase-all-tables-migration.sql`
**Status:** Complete system setup  
**When to use:** Initial database setup or complete system reset  
**What it does:**
- Creates all tables (tables, table_fields, views, pages, dashboards, etc.)
- Sets up all RLS policies
- Creates indexes and triggers
- Includes dashboard system

## Other Migrations

- `supabase-dynamic-system-migration.sql` - Dynamic table system
- `supabase-phase3-migrations.sql` - Phase 3 features
- `supabase-view-configs-migration.sql` - View configurations
- `supabase-data-migration.sql` - Data migration utilities

## Quick Reference

| Need | Use This File |
|------|---------------|
| First time setup | `supabase-all-tables-migration.sql` |
| Dashboard system only | `supabase-dashboard-system-complete.sql` |
| Fix dashboard issues | `supabase-dashboard-system-complete.sql` |
| Complete system reset | `supabase-all-tables-migration.sql` |

## How to Run Migrations

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the migration SQL
4. Click "Run"
5. Verify tables were created in the Table Editor

## Important Notes

- Always backup your database before running migrations
- Run migrations in order if using multiple files
- Check for existing tables before running (migrations use `CREATE TABLE IF NOT EXISTS`)
- RLS policies are permissive by default - adjust for your security needs

