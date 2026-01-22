# SQL Schema Corrections Required

This document lists all corrections needed for the database schema to match the actual migrations and TypeScript types.

## 1. `automation_runs` Table - CRITICAL FIX

### Current (WRONG):
```sql
CREATE TABLE public.automation_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  automation_id uuid,
  status text NOT NULL DEFAULT 'pending'::text,
  input jsonb,
  output jsonb,
  error text,
  executed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT automation_runs_pkey PRIMARY KEY (id),
  CONSTRAINT automation_runs_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id)
);
```

### Should be:
```sql
CREATE TABLE public.automation_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'stopped')),
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  error text,
  context jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT automation_runs_pkey PRIMARY KEY (id),
  CONSTRAINT automation_runs_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_automation_runs_automation_id ON automation_runs(automation_id);
CREATE INDEX idx_automation_runs_status ON automation_runs(status);
CREATE INDEX idx_automation_runs_started_at ON automation_runs(started_at);
```

### Issues Fixed:
- ❌ Status values wrong: 'pending' → should be 'running', 'completed', 'failed', 'stopped'
- ❌ Missing `started_at` and `completed_at` columns
- ❌ Has `executed_at` instead of `started_at`
- ❌ Has `input`/`output` instead of `context`
- ❌ Missing `created_at` column
- ❌ Missing `ON DELETE CASCADE` on foreign key
- ❌ Missing indexes for performance

---

## 2. `automation_logs` Table - CRITICAL FIX

### Current (WRONG):
```sql
CREATE TABLE public.automation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL,
  timestamp timestamp with time zone DEFAULT now(),
  status text NOT NULL CHECK (status = ANY (ARRAY['success'::text, 'error'::text])),
  input jsonb,
  output jsonb,
  error text,
  duration_ms integer,
  CONSTRAINT automation_logs_pkey PRIMARY KEY (id),
  CONSTRAINT automation_logs_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id)
);
```

### Should be:
```sql
CREATE TABLE public.automation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  run_id uuid REFERENCES automation_runs(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('info', 'warning', 'error')),
  message text NOT NULL,
  data jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT automation_logs_pkey PRIMARY KEY (id),
  CONSTRAINT automation_logs_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE,
  CONSTRAINT automation_logs_run_id_fkey FOREIGN KEY (run_id) REFERENCES automation_runs(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX idx_automation_logs_run_id ON automation_logs(run_id);
CREATE INDEX idx_automation_logs_created_at ON automation_logs(created_at);
```

### Issues Fixed:
- ❌ Field name wrong: `status` → should be `level`
- ❌ Status values wrong: 'success', 'error' → should be 'info', 'warning', 'error'
- ❌ Missing `run_id` foreign key to `automation_runs`
- ❌ Missing `message` field (required)
- ❌ Has `input`/`output` instead of `data`
- ❌ Has `timestamp` instead of `created_at`
- ❌ Remove `error` and `duration_ms` columns (not in migration)
- ❌ Missing `ON DELETE CASCADE` on foreign keys
- ❌ Missing indexes for performance

---

## 3. `interface_pages` Table - Remove 'blank' from page_type

### Current (WRONG):
```sql
page_type text NOT NULL CHECK (page_type = ANY (ARRAY['list'::text, 'gallery'::text, 'kanban'::text, 'calendar'::text, 'timeline'::text, 'form'::text, 'dashboard'::text, 'overview'::text, 'record_review'::text]))
```

### Should be:
```sql
page_type text NOT NULL CHECK (page_type IN ('list', 'gallery', 'kanban', 'calendar', 'timeline', 'form', 'dashboard', 'overview', 'record_review'))
```

### Issue:
- ❌ 'blank' is not a valid page_type (removed in `add_page_anchors.sql` migration)
- ✅ Anchor columns (`saved_view_id`, `dashboard_layout_id`, `form_config_id`, `record_config_id`) are correct

### Additional Indexes Needed:
```sql
CREATE INDEX idx_interface_pages_saved_view_id ON interface_pages(saved_view_id) WHERE saved_view_id IS NOT NULL;
CREATE INDEX idx_interface_pages_dashboard_layout_id ON interface_pages(dashboard_layout_id) WHERE dashboard_layout_id IS NOT NULL;
```

---

## 4. `views` Table - Verify Type Constraint

### Current:
```sql
type text NOT NULL CHECK (type = ANY (ARRAY['grid'::text, 'kanban'::text, 'calendar'::text, 'form'::text, 'interface'::text]))
```

### Should include (if needed):
```sql
type text NOT NULL CHECK (type IN ('grid', 'kanban', 'calendar', 'form', 'interface', 'gallery', 'timeline'))
```

### Note:
- Check if 'gallery' and 'timeline' should be included based on your ViewType definition
- Current constraint matches migration, but TypeScript types include 'gallery' and 'timeline'

---

## 5. `view_filters` Table - Verify Field Name

### Current:
```sql
CREATE TABLE public.view_filters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  view_id uuid,
  field_name text,
  operator text,
  value text,
  CONSTRAINT view_filters_pkey PRIMARY KEY (id),
  CONSTRAINT view_filters_view_id_fkey FOREIGN KEY (view_id) REFERENCES public.views(id)
);
```

### Verify:
- Migration uses `field_name`, but TypeScript types show `field_id`
- Check which is correct based on your implementation
- If using `field_id`, add foreign key: `REFERENCES table_fields(id)`

---

## 6. `view_sorts` Table - Verify Field Name

### Current:
```sql
CREATE TABLE public.view_sorts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  view_id uuid,
  field_name text NOT NULL,
  direction text NOT NULL CHECK (direction = ANY (ARRAY['asc'::text, 'desc'::text])),
  CONSTRAINT view_sorts_pkey PRIMARY KEY (id),
  CONSTRAINT view_sorts_view_id_fkey FOREIGN KEY (view_id) REFERENCES public.views(id)
);
```

### Verify:
- Migration uses `field_name`, but TypeScript types show `field_id` and `order_direction`
- Check which is correct based on your implementation
- If using `field_id`, add foreign key: `REFERENCES table_fields(id)`
- If using `order_direction`, rename `direction` column

---

## 7. Missing Indexes Summary

### For `automation_runs`:
```sql
CREATE INDEX idx_automation_runs_automation_id ON automation_runs(automation_id);
CREATE INDEX idx_automation_runs_status ON automation_runs(status);
CREATE INDEX idx_automation_runs_started_at ON automation_runs(started_at);
```

### For `automation_logs`:
```sql
CREATE INDEX idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX idx_automation_logs_run_id ON automation_logs(run_id);
CREATE INDEX idx_automation_logs_created_at ON automation_logs(created_at);
```

### For `interface_pages`:
```sql
CREATE INDEX idx_interface_pages_saved_view_id ON interface_pages(saved_view_id) WHERE saved_view_id IS NOT NULL;
CREATE INDEX idx_interface_pages_dashboard_layout_id ON interface_pages(dashboard_layout_id) WHERE dashboard_layout_id IS NOT NULL;
```

---

## 8. Foreign Key Constraints - Add Missing

### `automation_logs.run_id`:
```sql
CONSTRAINT automation_logs_run_id_fkey FOREIGN KEY (run_id) REFERENCES automation_runs(id) ON DELETE CASCADE
```

### `automation_runs.automation_id`:
```sql
-- Add ON DELETE CASCADE if missing
CONSTRAINT automation_runs_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE
```

### `automation_logs.automation_id`:
```sql
-- Add ON DELETE CASCADE if missing
CONSTRAINT automation_logs_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE
```

---

## 9. `automations` Table - Verify Structure

### Current:
```sql
CREATE TABLE public.automations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT ''::text,
  trigger jsonb NOT NULL,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'paused'::text])),
  CONSTRAINT automations_pkey PRIMARY KEY (id)
);
```

### Note:
- ✅ Structure matches migration
- ⚠️ TypeScript types suggest `trigger_type` and `trigger_config` instead of `trigger` jsonb
- Verify which structure is correct based on your implementation

---

## 10. Priority Summary

### 🔴 CRITICAL (Must Fix):
1. **`automation_runs`** - Wrong structure, wrong status values
2. **`automation_logs`** - Wrong field names, wrong values, missing FK

### 🟡 IMPORTANT (Should Fix):
3. **`interface_pages.page_type`** - Remove 'blank' from constraint
4. **Missing indexes** - Add performance indexes
5. **Foreign key cascades** - Add ON DELETE CASCADE

### 🟢 VERIFY (Check Implementation):
6. **`views.type`** - Verify if 'gallery' and 'timeline' should be included
7. **`view_filters`** - Verify `field_name` vs `field_id`
8. **`view_sorts`** - Verify `field_name` vs `field_id` and `direction` vs `order_direction`
9. **`automations.trigger`** - Verify jsonb structure vs separate columns

---

## Migration Script Template

```sql
-- Fix automation_runs table
ALTER TABLE automation_runs
  DROP CONSTRAINT IF EXISTS automation_runs_status_check,
  DROP COLUMN IF EXISTS input,
  DROP COLUMN IF EXISTS output,
  DROP COLUMN IF EXISTS executed_at;

ALTER TABLE automation_runs
  ADD COLUMN IF NOT EXISTS started_at timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS context jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

ALTER TABLE automation_runs
  ADD CONSTRAINT automation_runs_status_check CHECK (status IN ('running', 'completed', 'failed', 'stopped'));

-- Fix automation_logs table
ALTER TABLE automation_logs
  DROP CONSTRAINT IF EXISTS automation_logs_status_check,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS input,
  DROP COLUMN IF EXISTS output,
  DROP COLUMN IF EXISTS error,
  DROP COLUMN IF EXISTS duration_ms,
  DROP COLUMN IF EXISTS timestamp;

ALTER TABLE automation_logs
  ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES automation_runs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

ALTER TABLE automation_logs
  ADD CONSTRAINT automation_logs_level_check CHECK (level IN ('info', 'warning', 'error'));

-- Fix interface_pages page_type constraint
ALTER TABLE interface_pages
  DROP CONSTRAINT IF EXISTS interface_pages_page_type_check;

ALTER TABLE interface_pages
  ADD CONSTRAINT interface_pages_page_type_check 
  CHECK (page_type IN ('list', 'gallery', 'kanban', 'calendar', 'timeline', 'form', 'dashboard', 'overview', 'record_review'));

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_id ON automation_runs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON automation_runs(status);
CREATE INDEX IF NOT EXISTS idx_automation_runs_started_at ON automation_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_run_id ON automation_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON automation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_interface_pages_saved_view_id ON interface_pages(saved_view_id) WHERE saved_view_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interface_pages_dashboard_layout_id ON interface_pages(dashboard_layout_id) WHERE dashboard_layout_id IS NOT NULL;
```
