# Real-time Collaboration Setup

Phase 1 live data sync uses **Supabase Realtime** (postgres_changes). Enable it for the tables you want to sync.

## Enable Realtime in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. Go to **Database** → **Replication**
3. Enable **Realtime** for:
   - `view_blocks` – so block add/edit/delete syncs across users
   - Your content tables (e.g. `table_content_*`) – so grid/list rows sync

For **view_blocks**, enable Realtime so all page blocks stay in sync.

For **content tables**, the physical table name comes from `tables.supabase_table` (e.g. `table_content_1768242820540`). You can either:

- Enable Realtime for each content table as you create it, or
- Use a migration to add tables to the `supabase_realtime` publication

### Add tables via SQL

```sql
-- Add view_blocks to Realtime publication (if not already)
ALTER PUBLICATION supabase_realtime ADD TABLE view_blocks;

-- For dynamic content tables, add as needed:
-- ALTER PUBLICATION supabase_realtime ADD TABLE table_content_XXXXX;
```

## What syncs

| Component | Table | On change |
|-----------|-------|-----------|
| Page blocks | `view_blocks` | Reload blocks from API |
| Grid view | Dynamic table (e.g. `table_content_*`) | Revalidate via SWR |
| List view | Dynamic table | Reload rows |

## RLS

Realtime respects RLS. Users only receive changes for rows they can `SELECT`. Ensure your RLS policies allow read access for the relevant roles.
