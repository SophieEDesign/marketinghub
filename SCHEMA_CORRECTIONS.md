# Schema Corrections Needed

## Critical Issues

### 1. `views` table
**Issues:**
- ❌ Type CHECK constraint includes `'page'` but NOT `'interface'` (we use `type='interface'` for interface pages)
- ❌ Missing `description` column
- ❌ Missing `updated_at` column  
- ❌ `table_id` should be nullable (interface pages don't belong to a table)
- ❌ `allowed_roles ARRAY` syntax is incorrect

**Corrected:**
```sql
CREATE TABLE public.views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  table_id uuid,  -- NULLABLE for interface pages
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['grid'::text, 'kanban'::text, 'calendar'::text, 'form'::text, 'interface'::text])),
  description text,
  config jsonb DEFAULT '{}'::jsonb,
  access_level text NOT NULL DEFAULT 'authenticated'::text,
  allowed_roles text[],  -- Fixed syntax
  owner_id uuid,
  public_share_id uuid DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),  -- ADD THIS
  CONSTRAINT views_pkey PRIMARY KEY (id),
  CONSTRAINT views_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE CASCADE
);
```

### 2. `view_blocks` table
**Issues:**
- ❌ Has `position jsonb` but our code expects separate columns: `position_x`, `position_y`, `width`, `height`
- ❌ Missing `config` column (has `settings` and `visibility` but we use `config`)
- ❌ Missing `order_index` column

**Corrected:**
```sql
CREATE TABLE public.view_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  view_id uuid NOT NULL,
  type text NOT NULL,
  position_x integer NOT NULL DEFAULT 0,  -- CHANGED from position jsonb
  position_y integer NOT NULL DEFAULT 0,  -- ADD THIS
  width integer NOT NULL DEFAULT 4,       -- ADD THIS
  height integer NOT NULL DEFAULT 4,       -- ADD THIS
  config jsonb DEFAULT '{}'::jsonb,       -- CHANGED from settings/visibility
  order_index integer NOT NULL DEFAULT 0, -- ADD THIS
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),  -- ADD THIS
  CONSTRAINT view_blocks_pkey PRIMARY KEY (id),
  CONSTRAINT view_blocks_view_id_fkey FOREIGN KEY (view_id) REFERENCES public.views(id) ON DELETE CASCADE
);
```

### 3. `tables` table
**Issues:**
- ❌ Missing `supabase_table` column (CRITICAL - used throughout the codebase)
- ❌ Missing `created_by` column
- ❌ Missing `updated_at` column

**Corrected:**
```sql
CREATE TABLE public.tables (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  supabase_table text NOT NULL,  -- ADD THIS (CRITICAL)
  description text DEFAULT ''::text,
  category text,
  created_by uuid REFERENCES auth.users(id),  -- ADD THIS
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),  -- ADD THIS
  CONSTRAINT tables_pkey PRIMARY KEY (id)
);
```

### 4. `view_fields` table
**Issues:**
- ❌ Uses `field_name` (text) - this might be okay if your implementation uses field names
- ❌ Missing `visible` column (code uses `visible`, not `hidden`)

**Note:** Your codebase uses `field_name` in some places, so this might be correct. But check if you need:
```sql
visible boolean DEFAULT true,  -- ADD THIS if using visible
-- OR keep hidden if that's what you use
```

### 5. Missing `workspaces` table
**Issue:**
- ❌ Missing `workspaces` table (used by Settings → Workspace tab)

**Add:**
```sql
CREATE TABLE public.workspaces (
  id text PRIMARY KEY DEFAULT 'default',
  name text NOT NULL DEFAULT 'Marketing Hub',
  icon text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
```

## Summary

The main issues are:
1. **views.type** must include `'interface'` (not just `'page'`)
2. **view_blocks** needs separate position columns, not a JSONB position
3. **tables** needs `supabase_table` column
4. **views** needs `description` and `updated_at`
5. **view_blocks** needs `config` and `order_index`
6. Missing `workspaces` table
