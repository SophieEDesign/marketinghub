# Filter System Standardization

## Overview

This document describes the unified, standardized filter system implemented across the entire application. All filters now use a single canonical model and shared evaluation engine, ensuring consistent behavior everywhere.

## Core Principles

1. **Filters are data, not UI** - The filter structure is independent of how it's displayed
2. **All filters share the same underlying structure** - No per-block filter logic
3. **Groups define logic (AND / OR)** - Explicit, visible logic
4. **UI surfaces render the same filter model differently if needed** - Same data, different presentation
5. **Evaluation logic is shared everywhere** - Single source of truth

## Canonical Filter Model

The canonical filter model is defined in `baserow-app/lib/filters/canonical-model.ts`.

### Structure

```
FilterTree = FilterGroup | FilterCondition | null

FilterGroup {
  operator: 'AND' | 'OR'
  children: Array<FilterCondition | FilterGroup>  // Supports nesting
}

FilterCondition {
  field_id: string
  operator: FilterOperator
  value?: string | number | boolean | string[] | null
}
```

### Key Features

- **Tree structure** - Supports nested groups for complex logic
- **Explicit operators** - AND/OR logic is always visible
- **Field-type agnostic** - Model doesn't care about field types
- **Normalizable** - Single conditions become groups automatically

## Shared Evaluation Engine

The evaluation engine (`baserow-app/lib/filters/evaluation.ts`) is the single source of truth for filter evaluation.

### Functions

- `applyFiltersToQuery(query, filterTree)` - Apply filters to Supabase query
- `evaluateFilterTree(row, filterTree, getFieldValue?)` - Evaluate filters against a single row

### Behavior

- **AND groups**: Conditions are chained normally (Supabase defaults to AND)
- **OR groups**: Uses Supabase's `.or()` method with filter strings
- **Nested groups**: Recursively processed
- **Empty groups**: Invalid, prevented by UI

## Database Schema

Filters are stored in two tables:

- `view_filters` - Individual filter conditions
- `view_filter_groups` - Groups with AND/OR logic

### Schema Details

```sql
view_filter_groups:
  - id (uuid)
  - view_id (uuid)
  - condition_type ('AND' | 'OR')
  - order_index (integer)

view_filters:
  - id (uuid)
  - view_id (uuid)
  - field_name (text)
  - operator (text)
  - value (text)
  - filter_group_id (uuid, nullable)  -- Links to group
  - order_index (integer)
```

### Conversion

Converters in `baserow-app/lib/filters/converters.ts` handle:
- `dbFiltersToFilterTree()` - Database → Canonical model
- `filterTreeToDbFormat()` - Canonical model → Database
- `filterConfigsToFilterTree()` - FilterBlock format → Canonical model

## Usage Patterns

### 1. Loading and Applying Filters (lib/data.ts)

```typescript
import { dbFiltersToFilterTree } from '@/lib/filters/converters'
import { applyFiltersToQuery } from '@/lib/filters/evaluation'

// Load filters and groups from database
const filters = await loadFilters(viewId)
const groups = await loadFilterGroups(viewId)

// Convert to canonical model
const filterTree = dbFiltersToFilterTree(filters, groups)

// Apply to query
let query = supabase.from('table').select('*')
query = applyFiltersToQuery(query, filterTree)
```

### 2. Filter Dialog (FilterDialog.tsx)

The FilterDialog component:
- Loads filters and groups from database
- Converts to canonical model for editing
- Supports nested groups (UI shows indentation)
- Saves back to database format

### 3. Filter Block (FilterBlock.tsx)

The Filter Block is a special case:
- **Allowed**: Flat conditions (no groups)
- **Still uses**: Canonical model (each condition is a group of one)
- **Evaluation**: Shared evaluation engine

This ensures simplicity for lightweight use while maintaining consistency.

## Field-Type Awareness

Filter UI components must respect field types:

- **Select fields**: Show option dropdowns
- **Linked fields**: Show record pickers
- **Lookup fields**: Filterable but read-only
- **Date fields**: Date pickers with date-specific operators
- **Number fields**: Numeric inputs with comparison operators
- **Text fields**: Text inputs with contains/equals operators

Invalid operator + field combinations are prevented by the UI.

## Filter Operators

### Text Fields
- `contains` / `not_contains`
- `equal` / `not_equal`
- `is_empty` / `is_not_empty`

### Number Fields
- `equal` / `not_equal`
- `greater_than` / `less_than`
- `greater_than_or_equal` / `less_than_or_equal`
- `is_empty` / `is_not_empty`

### Date Fields
- `date_equal` / `date_before` / `date_after`
- `date_on_or_before` / `date_on_or_after`
- `is_empty` / `is_not_empty`

### Select Fields
- `equal` / `not_equal`
- `is_empty` / `is_not_empty`

### Linked Fields
- `has` / `does_not_have` (future)
- `is_empty` / `is_not_empty`

## UI Rules

All filter UIs must:

1. **Show group boundaries** - Visual indication of groups
2. **Show AND/OR logic** - Explicit operator selection
3. **No implicit logic** - Everything is visible
4. **No magic defaults** - Users see exactly what will happen
5. **Consistent editing** - Same feel across grid views, blocks, dashboards

## Evaluation Rules

1. **Top-down evaluation** - Filters evaluated in order
2. **Group logic respected** - AND/OR applied exactly as specified
3. **No short-circuit surprises** - All conditions evaluated
4. **Empty groups invalid** - Prevented by UI validation

## Migration Notes

### Existing Filters

Existing filters without groups are automatically:
- Treated as ungrouped filters
- Combined with AND logic
- Compatible with new system

### Backward Compatibility

The system maintains backward compatibility:
- Old filters (no groups) still work
- New filters (with groups) work alongside old ones
- Gradual migration is supported

## Files Modified

### Core System
- `baserow-app/lib/filters/canonical-model.ts` - Filter model definition
- `baserow-app/lib/filters/evaluation.ts` - Evaluation engine
- `baserow-app/lib/filters/converters.ts` - Format converters
- `baserow-app/lib/filters/index.ts` - Module exports

### Database
- `supabase/migrations/add_filter_groups_support.sql` - Schema migration
- `baserow-app/types/database.ts` - TypeScript types
- `types/database.ts` - Root types

### Application Code
- `lib/data.ts` - Uses shared evaluation engine
- `baserow-app/components/grid/FilterDialog.tsx` - Filter editing UI
- `baserow-app/components/interface/blocks/FilterBlock.tsx` - Filter block (special case)

## Future Enhancements

1. **Nested groups in database** - Currently flattened, could support true nesting
2. **Linked field filters** - "has" / "does not have" operators
3. **Lookup field filters** - Filter by lookup field values
4. **Formula field filters** - Filter by computed values
5. **Filter presets** - Save and reuse filter configurations

## Testing

All filter evaluation should be tested through:
- Unit tests for evaluation engine
- Integration tests for database queries
- UI tests for filter editing
- End-to-end tests for filter application

## Summary

The standardized filter system provides:
- ✅ Single canonical model
- ✅ Shared evaluation engine
- ✅ Consistent behavior everywhere
- ✅ Field-type awareness
- ✅ Support for complex AND/OR logic
- ✅ Special case for Filter Block (flat conditions)
- ✅ Backward compatibility

This ensures filters are predictable, powerful, and familiar to users who know Airtable-style filtering.
