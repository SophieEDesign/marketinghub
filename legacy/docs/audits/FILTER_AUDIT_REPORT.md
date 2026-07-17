# Filter System Audit Report

**Date:** 2025-01-XX  
**Scope:** Block-Level vs Page-Level Filtering  
**Goal:** Audit filtering across pages and blocks, identify gaps, and document required fixes

---

## Executive Summary

The current filtering system has **partial implementation** with significant gaps:

✅ **What Works:**
- Block-level filters stored in `view_blocks.config.filters`
- Shared filter application logic (`applyFiltersToQuery`)
- Chart and KPI blocks support block filters + page filters (merged)
- Calendar block supports filters from block config

❌ **What's Missing:**
- No dedicated Filter Block component
- No mechanism for shared/reusable filters across multiple blocks
- Grid block does NOT receive page-level filters
- No clear filter precedence documentation
- No filter state persistence mechanism
- Inconsistent filter handling across block types

---

## 1️⃣ Block-Level Filters (Default / Base Filters)

### Current Implementation

**Storage Location:**
- Filters stored in `view_blocks.config.filters` as `BlockFilter[]`
- Format: `{ field: string, operator: string, value: any }`

**Supported Blocks:**

| Block Type | Filter Support | Storage | Applied At |
|------------|---------------|---------|------------|
| **Grid** | ✅ Yes | `config.filters` | Query level (SQL) |
| **Calendar** | ✅ Yes | `config.filters` | Query level (SQL) |
| **Chart** | ✅ Yes | `config.filters` | Query level (SQL) |
| **KPI** | ✅ Yes | `config.filters` | Server API |
| **Kanban** | ✅ Yes (via GridBlock view_type) | `config.filters` | Query level (SQL) |
| **Timeline** | ✅ Yes (via GridBlock view_type) | `config.filters` | Query level (SQL) |
| **Record Review** | ✅ Yes (client-side) | `config.filters` | Client-side filtering |

### Code Evidence

**Grid Block** (`baserow-app/components/interface/blocks/GridBlock.tsx`):
```typescript
const filtersConfig = config?.filters || []
const activeFilters = filtersConfig.length > 0
  ? filtersConfig.map((f: any) => ({
      id: f.field || '',
      field_name: f.field || '',
      operator: f.operator || 'eq',
      value: f.value,
    }))
  : viewFilters
```

**Chart Block** (`baserow-app/components/interface/blocks/ChartBlock.tsx`):
```typescript
const blockFilters = config?.filters || []
const allFilters = useMemo(() => {
  const merged: FilterConfig[] = [...filters] // page filters
  for (const blockFilter of blockFilters) {
    const existingIndex = merged.findIndex(f => f.field === blockFilter.field)
    if (existingIndex >= 0) {
      merged[existingIndex] = blockFilter as FilterConfig // block overrides
    } else {
      merged.push(blockFilter as FilterConfig)
    }
  }
  return merged
}, [filters, blockFilters])
```

**KPI Block** (`baserow-app/components/interface/blocks/KPIBlock.tsx`):
```typescript
// Same merge logic as ChartBlock
const blockFilters = config?.filters || []
const allFilters = useMemo(() => {
  // Merge filters - block filters override page filters for same field
  const merged: FilterConfig[] = [...filters]
  // ... same override logic
}, [filters, blockFilters])
```

**Calendar Block** (`baserow-app/components/views/CalendarView.tsx`):
```typescript
// Receives filters as props, applies via applyFiltersToQuery
filters={calendarFilters} // From block config only
```

### Findings

✅ **Confirmed:**
- Blocks CAN define base filters in `config.filters`
- Filters are stored in `view_blocks.config` JSONB column
- Filters are applied at SQL query level
- Block filters work independently (Grid, Calendar render correctly with own filters)

⚠️ **Issues:**
- **Grid block does NOT receive page-level filters** (only Chart/KPI do)
- **Calendar block does NOT receive page-level filters** (only from block config)
- No validation that filters are always enforced
- Filter format inconsistent: Grid uses `{field_name, operator, value}`, others use `{field, operator, value}`

---

## 2️⃣ Filter Block Audit (Shared / Interactive Filters)

### Current State: ❌ NOT IMPLEMENTED

**Search Results:**
- No `FilterBlock.tsx` component found
- No filter block type in block registry
- No mechanism for filter blocks to emit state to other blocks

### What Should Exist (But Doesn't)

**Expected Behavior:**
1. Filter block as standalone block type
2. Filter block emits filter state (field + operator + value)
3. Filter block config defines:
   - Target blocks (IDs or scope rules)
   - Allowed fields
   - Allowed operators
4. Connected blocks reactively update when filter block changes

**Current Workaround:**
- Page-level filters passed as props to Chart/KPI blocks
- No UI for configuring page-level filters
- No way to apply filters to multiple blocks simultaneously

### Code Evidence

**BlockRenderer** (`baserow-app/components/interface/BlockRenderer.tsx`):
```typescript
// No filter prop passed to GridBlock
case "grid":
  return <GridBlock block={safeBlock} isEditing={canEdit} pageTableId={null} pageId={pageId} />

// Chart/KPI receive filters prop (but source unclear)
case "chart":
  return <ChartBlock block={safeBlock} isEditing={canEdit} pageTableId={pageTableId} pageId={pageId} />
case "kpi":
  return <KPIBlock block={safeBlock} isEditing={canEdit} pageTableId={pageTableId} pageId={pageId} />
```

**Missing:**
- No `filters` prop passed to GridBlock
- No filter state management at page level
- No FilterBlock component

---

## 3️⃣ Filter Precedence Rules

### Current Implementation

**Documented Behavior** (`baserow-app/lib/interface/filters.ts`):
```typescript
/**
 * Merges page-level filters with block-level filters
 * Block filters override page filters for the same field
 */
export function mergeFilters(
  pageFilters: FilterConfig[] = [],
  blockFilters: BlockFilter[] = []
): FilterConfig[] {
  const merged: FilterConfig[] = [...pageFilters]
  
  // Add block filters, overriding page filters for same field
  for (const blockFilter of blockFilters) {
    const normalized = normalizeFilter(blockFilter)
    const existingIndex = merged.findIndex(f => f.field === normalized.field)
    
    if (existingIndex >= 0) {
      merged[existingIndex] = normalized // BLOCK OVERRIDES PAGE
    } else {
      merged.push(normalized)
    }
  }
  
  return merged
}
```

### Precedence Order (Current)

1. **Block base filters** (always applied) ✅
2. **Page-level filters** (merged, but block overrides for same field) ⚠️
3. **Filter block state** ❌ (doesn't exist)
4. **Temporary UI filters** ❌ (no clear mechanism)

### Issues

❌ **Problems:**
- Precedence only documented in code comments, not user-facing
- No enforcement that block filters cannot be overridden
- Grid block doesn't participate in precedence (no page filters)
- No way to ensure "block filters always applied" rule

**Example Scenario:**
```
Block filter: content_type = "Social Media"
Filter block: status = "Scheduled"
Expected: Scheduled social media posts only
Current: ❌ Cannot test (no filter block)
```

---

## 4️⃣ Filter Configuration Storage

### Current Storage Locations

| Filter Type | Storage Location | Format | Persistence |
|-------------|----------------|--------|-------------|
| **Block filters** | `view_blocks.config.filters` | `BlockFilter[]` | ✅ Persisted |
| **View filters** | `view_filters` table | `{view_id, field_name, operator, value}` | ✅ Persisted |
| **Page filters** | ❌ Not stored | Passed as props | ❌ Lost on refresh |
| **Filter block state** | ❌ Doesn't exist | N/A | N/A |

### Code Evidence

**Block Config Storage** (`supabase/schema.sql`):
```sql
CREATE TABLE IF NOT EXISTS public.view_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  view_id uuid,
  type text,
  config jsonb DEFAULT '{}'::jsonb, -- filters stored here
  ...
);
```

**View Filters Table** (`supabase/schema.sql`):
```sql
CREATE TABLE IF NOT EXISTS public.view_filters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  view_id uuid,
  field_name text,
  operator text,
  value text,
  ...
);
```

### Issues

❌ **Problems:**
- Page-level filters not persisted (only passed as props)
- No filter block state storage
- Filter state lost on page refresh (for page-level filters)
- No URL parameter support for filter state
- No clear distinction between "base filters" and "user filters"

**Missing Storage:**
- Filter block config (target blocks, allowed fields)
- Filter block state (current filter values)
- Page-level filter preferences

---

## 5️⃣ SQL & Query Generation Audit

### Current Implementation

**Shared Filter Logic** (`baserow-app/lib/interface/filters.ts`):
```typescript
export function applyFiltersToQuery(
  query: any,
  filters: FilterConfig[],
  tableFields: Array<{ name: string; type: string }> = []
): any {
  // Applies filters to Supabase query builder
  // Supports: equal, not_equal, contains, greater_than, less_than, etc.
}
```

**Usage by Block Type:**

| Block | Filter Application | Location |
|-------|-------------------|----------|
| **Grid** | Custom logic in `GridView.tsx` | `baserow-app/components/grid/GridView.tsx:90-123` |
| **Calendar** | `applyFiltersToQuery()` | `baserow-app/components/views/CalendarView.tsx:146` |
| **Chart** | `applyFiltersToQuery()` | `baserow-app/components/interface/blocks/ChartBlock.tsx:138` |
| **KPI** | Server API (`/api/dashboard/aggregate`) | `baserow-app/components/interface/blocks/KPIBlock.tsx:73` |
| **Table Snapshot** | Custom logic (view filters only) | `baserow-app/components/interface/blocks/TableSnapshotBlock.tsx:106-122` |

### Issues

⚠️ **Problems:**
- **Duplicated logic**: Grid has its own filter application (doesn't use `applyFiltersToQuery`)
- **Inconsistent operators**: Grid uses `"equal"`, others use `"eq"`
- **No SQL view reuse**: Each block queries table directly
- **No query optimization**: Filters applied per-block, not shared

**Grid Filter Logic** (`baserow-app/components/grid/GridView.tsx`):
```typescript
switch (filter.operator) {
  case "equal":        // Different from FilterConfig
    query = query.eq(filter.field_name, fieldValue)
    break
  case "not_equal":    // Different from FilterConfig
    query = query.neq(filter.field_name, fieldValue)
    break
  // ... more operators
}
```

**Shared Filter Logic** (`baserow-app/lib/interface/filters.ts`):
```typescript
switch (filter.operator) {
  case 'equal':        // Same name, but different format
    query = query.eq(fieldName, fieldValue)
    break
  case 'not_equal':    // Different from Grid
    query = query.neq(fieldName, fieldValue)
    break
  // ... more operators
}
```

---

## 6️⃣ Airtable Parity Check

### Required Capabilities

| Feature | Airtable | Current Status | Gap |
|---------|----------|----------------|-----|
| Calendar filtered to content type | ✅ | ⚠️ Partial (block filter only) | No filter block |
| Global filter (Status = Scheduled) | ✅ | ❌ No global filter | Missing |
| Quick category filter | ✅ | ❌ No UI | Missing |
| Multiple blocks respond to same filter | ✅ | ❌ No filter block | Missing |
| Filters editable without editing block | ✅ | ⚠️ Partial (view filters) | No filter block UI |

### Current Capabilities

✅ **What Works:**
- Calendar view with block-level filters
- Grid view with block-level filters
- Chart/KPI with merged filters (block + page)

❌ **What's Missing:**
- Filter block component
- Shared filter state across blocks
- Filter UI without editing block
- Global page-level filters (for Grid/Calendar)

---

## 7️⃣ Exact Fixes Required

### Priority 1: Critical Gaps

#### Fix 1.1: Create Filter Block Component
**File:** `baserow-app/components/interface/blocks/FilterBlock.tsx` (NEW)

**Requirements:**
- Standalone block type `"filter"`
- Emits filter state (field + operator + value)
- Config defines target blocks (block IDs or "all")
- Config defines allowed fields/operators
- State stored in block config or page state

**Config Structure:**
```typescript
{
  type: "filter",
  config: {
    target_blocks: string[] | "all",  // Which blocks to control
    allowed_fields: string[],          // Fields user can filter by
    allowed_operators: string[],       // Operators user can use
    filters: FilterConfig[]            // Current filter state
  }
}
```

#### Fix 1.2: Pass Page Filters to All Data Blocks
**Files:**
- `baserow-app/components/interface/BlockRenderer.tsx`
- `baserow-app/components/interface/blocks/GridBlock.tsx`
- `baserow-app/components/interface/blocks/CalendarBlock.tsx` (if exists)

**Changes:**
```typescript
// BlockRenderer.tsx
case "grid":
  return <GridBlock block={safeBlock} filters={pageFilters} ... />

// GridBlock.tsx
interface GridBlockProps {
  filters?: FilterConfig[] // Add page filters prop
}
```

#### Fix 1.3: Standardize Filter Format
**Files:**
- `baserow-app/components/grid/GridView.tsx`
- `baserow-app/lib/interface/filters.ts`

**Changes:**
- Use `FilterConfig` format everywhere
- Remove duplicate filter application logic
- Use `applyFiltersToQuery()` in Grid block

### Priority 2: Filter Precedence & Storage

#### Fix 2.1: Document Filter Precedence
**File:** `FILTER_PRECEDENCE.md` (NEW)

**Rules:**
1. Block base filters (always applied, cannot be overridden)
2. Filter block state (user-controlled, narrows results)
3. Temporary UI filters (if any)

#### Fix 2.2: Persist Filter Block State
**Options:**
- Store in `view_blocks.config.filters` (for filter blocks)
- Store in page state (URL params or localStorage)
- Store in `interface_pages.config.filter_state`

### Priority 3: UI & UX

#### Fix 3.1: Filter Block Settings UI
**File:** `baserow-app/components/interface/settings/FilterBlockSettings.tsx` (NEW)

**Features:**
- Select target blocks
- Configure allowed fields/operators
- Filter builder UI (field + operator + value)

#### Fix 3.2: Filter State Management
**File:** `baserow-app/lib/interface/filter-state.ts` (NEW)

**Features:**
- React context for filter state
- Filter block state updates trigger block re-renders
- No reload loops (use React state, not URL)

---

## 8️⃣ Architecture Diagram

### Current Architecture (Broken)

```
Page
├── BlockRenderer
│   ├── GridBlock (no page filters ❌)
│   ├── ChartBlock (receives filters ✅)
│   ├── KPIBlock (receives filters ✅)
│   └── CalendarBlock (no page filters ❌)
└── [No Filter Block ❌]
```

### Target Architecture

```
Page
├── FilterBlock (NEW)
│   ├── Emits: filterState
│   └── Config: target_blocks, allowed_fields
├── BlockRenderer
│   ├── GridBlock (receives filters ✅)
│   ├── ChartBlock (receives filters ✅)
│   ├── KPIBlock (receives filters ✅)
│   └── CalendarBlock (receives filters ✅)
└── Filter State Context (NEW)
    └── Manages filter state across blocks
```

### Filter Flow

```
1. Filter Block emits filter state
   ↓
2. Filter State Context updates
   ↓
3. Target blocks receive updated filters
   ↓
4. Blocks merge: blockFilters + filterBlockState
   ↓
5. applyFiltersToQuery() generates SQL
   ↓
6. Blocks render with filtered data
```

---

## 9️⃣ Summary

### What Works Today ✅

1. **Block-level filters** stored in `config.filters`
2. **Filter application** at SQL level (for Chart/Calendar/KPI)
3. **Filter merging** logic (block overrides page for same field)
4. **Shared filter utilities** (`applyFiltersToQuery`)

### What's Missing ❌

1. **Filter Block component** (no shared filters)
2. **Page filters for Grid/Calendar** (inconsistent)
3. **Filter state persistence** (lost on refresh)
4. **Filter precedence documentation** (only in code)
5. **Standardized filter format** (Grid uses different format)
6. **Filter UI without editing block** (no filter block settings)

### Required Fixes

**Must Have:**
1. Create FilterBlock component
2. Pass page filters to Grid/Calendar blocks
3. Standardize filter format (use FilterConfig everywhere)
4. Document filter precedence rules

**Should Have:**
5. Filter state persistence (URL or page config)
6. Filter block settings UI
7. Filter state context (React context)

**Nice to Have:**
8. Filter templates/presets
9. Filter validation UI
10. Filter performance optimization

---

## 🔟 Confirmation: No New Page Types Required

✅ **Confirmed:** All filtering can be implemented using:
- Existing block types (add FilterBlock)
- Existing page types (dashboard, overview, content)
- Config + SQL only (no page type changes)

**No hardcoded behavior needed:**
- Filter blocks work on any page type
- Block filters work independently
- Filter precedence handled in code, not page type

---

## 📋 Next Steps

1. **Review this audit** with team
2. **Prioritize fixes** (start with Priority 1)
3. **Create FilterBlock component** (Fix 1.1)
4. **Update BlockRenderer** to pass filters (Fix 1.2)
5. **Standardize filter format** (Fix 1.3)
6. **Test filter precedence** with real scenarios
7. **Document filter system** for users

---

**End of Audit Report**

