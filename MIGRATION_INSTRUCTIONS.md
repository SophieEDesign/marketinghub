# Database Migration Required

## Dashboard Blocks Fix Migration

The dashboard system requires a database migration to be run before it will work properly.

### Migration File
`supabase-dashboard-blocks-fix-complete.sql`

### What This Migration Does
1. Adds missing grid layout columns to `dashboard_blocks` table:
   - `position_x` (INTEGER, default 0)
   - `position_y` (INTEGER, default 0)
   - `width` (INTEGER, default 3)
   - `height` (INTEGER, default 3)

2. Updates the type check constraint to allow all 7 block types:
   - `text`
   - `image`
   - `embed`
   - `kpi`
   - `table`
   - `calendar`
   - `html`

3. Creates indexes for better performance

### How to Run

#### Option 1: Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `supabase-dashboard-blocks-fix-complete.sql`
5. Click **Run** (or press Ctrl+Enter)

#### Option 2: Supabase CLI
```bash
supabase db push
# Or
psql -h your-db-host -U postgres -d postgres -f supabase-dashboard-blocks-fix-complete.sql
```

### Verification
After running the migration, you should be able to:
- Add new dashboard blocks without errors
- Drag and resize blocks in edit mode
- See all block types (text, image, embed, kpi, table, calendar, html) working

### Current Errors (Before Migration)
- `Could not find the 'height' column of 'dashboard_blocks' in the schema cache`
- `new row for relation "dashboard_blocks" violates check constraint "dashboard_blocks_type_check"`

These errors will disappear after running the migration.

