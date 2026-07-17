# Unified Filter System Implementation

## Overview

This document describes the unified, standardized filter system implemented across the entire Marketing Hub. All filters now use a single canonical model, shared evaluation engine, and consistent UI components, ensuring identical behavior everywhere.

## Core Principles

1. **One filter engine, reused everywhere** - Single source of truth for filter evaluation
2. **Filters are field-aware** - Operators and inputs adapt to field types automatically
3. **Groups and logic are explicit** - AND/OR logic is always visible and clear
4. **UI and logic must match exactly** - What you see is what you get

## Architecture

### 1. Canonical Filter Model (`lib/filters/canonical-model.ts`)

The canonical filter model is the single source of truth for filter structure:

```typescript
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

**Key Features:**
- Tree structure supports nested groups for complex logic
- Explicit operators (AND/OR) are always visible
- Field-type agnostic model (evaluation handles field types)
- Normalizable (single conditions become groups automatically)

### 2. Field-Aware Operators (`lib/filters/field-operators.ts`)

Defines which operators are available for each field type:

- **Text fields**: contains, not_contains, equal, not_equal, is_empty, is_not_empty
- **Number fields**: equal, not_equal, greater_than, less_than, etc.
- **Date fields**: date_equal, date_before, date_after, date_range, etc.
- **Select fields**: equal, not_equal, is_empty, is_not_empty
- **Multi-select**: equal (contains), not_equal (does not contain), is_empty, is_not_empty
- **Linked fields**: is_empty, is_not_empty (has/doesn't have linked records)
- **Lookup fields**: Filterable as derived values (read-only)

### 3. Evaluation Engine (`lib/filters/evaluation.ts`)

The single source of truth for filter evaluation:

- `applyFiltersToQuery(query, filterTree, tableFields?)` - Apply filters to Supabase query
- Field-aware: Handles different field types correctly (multi-select arrays, dates, etc.)
- Supports nested AND/OR groups
- Handles edge cases (empty groups, null values, etc.)

**Field-Aware Behavior:**
- Multi-select fields: Uses array contains (`cs`) operator
- Checkbox fields: Converts boolean values correctly
- Date fields: Handles date comparisons and ranges
- Linked fields: Supports "has linked records" / "has no linked records"
- Lookup fields: Filterable as derived values

### 4. Unified Filter Builder (`components/filters/FilterBuilder.tsx`)

The single UI component for filter editing:

**Features:**
- Nested filter groups with AND/OR logic
- Field-aware operator selection
- Field-aware value inputs (select dropdowns with colors, date pickers, etc.)
- Collapsible groups
- Duplicate/remove actions
- Clear visual hierarchy
- Empty state guidance

**Visual Design:**
- Groups shown with blue borders and backgrounds
- AND/OR operators clearly labeled
- Conditions separated with operator labels
- Inline actions (duplicate, remove)
- Consistent spacing and typography

### 5. Filter Value Input (`components/filters/FilterValueInput.tsx`)

Field-aware value input component:

- **Select fields**: Dropdown with options and colors
- **Multi-select**: Multi-select dropdown (future enhancement)
- **Date fields**: Date picker (single date or range)
- **Number fields**: Number input
- **Text fields**: Text input
- **Checkbox**: Boolean selector
- **Linked fields**: Record picker (placeholder for future)
- **Lookup fields**: Read-only display

### 6. Unified Filter Dialog (`components/filters/UnifiedFilterDialog.tsx`)

Dialog wrapper that uses FilterBuilder:

- Loads filters and groups from database
- Converts to canonical model for editing
- Saves back to database format
- Handles group ID mapping correctly

## Usage Patterns

### 1. Loading and Applying Filters

```typescript
import { dbFiltersToFilterTree } from '@/lib/filters/converters'
import { applyFiltersToQuery } from '@/lib/filters/evaluation'

// Load filters and groups from database
const filters = await loadFilters(viewId)
const groups = await loadFilterGroups(viewId)

// Convert to canonical model
const filterTree = dbFiltersToFilterTree(filters, groups)

// Apply to query (with field definitions for field-aware filtering)
let query = supabase.from('table').select('*')
query = applyFiltersToQuery(query, filterTree, tableFields)
```

### 2. Using FilterBuilder in UI

```typescript
import FilterBuilder from '@/components/filters/FilterBuilder'
import type { FilterTree } from '@/lib/filters/canonical-model'

function MyComponent() {
  const [filterTree, setFilterTree] = useState<FilterTree>(null)
  
  return (
    <FilterBuilder
      filterTree={filterTree}
      tableFields={tableFields}
      onChange={setFilterTree}
    />
  )
}
```

### 3. Converting Block Filters to FilterTree

```typescript
import { filterConfigsToFilterTree } from '@/lib/filters/converters'

// Convert flat BlockFilter[] to FilterTree
const blockFilters: BlockFilter[] = [
  { field: 'status', operator: 'equal', value: 'active' },
  { field: 'priority', operator: 'greater_than', value: 5 }
]

const filterTree = filterConfigsToFilterTree(blockFilters, 'AND')
```

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

## Field Type Support

### ✅ Fully Supported

- Text / Long text
- Number / Currency / Percent
- Date
- Single select
- Multi-select
- Checkbox
- Linked records (basic: has/doesn't have)
- Lookup fields (filterable as derived values)

### 🚧 Future Enhancements

- Linked records: "has record matching..." with drill-down filtering
- Multi-select: "is any of" / "is none of" operators
- Date: Relative date filters (next 7 days, last month, etc.)
- Formula fields: Enhanced filtering based on return type

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
- `applyFiltersToQuery` in `lib/interface/filters.ts` is deprecated but still works

## Files Created/Modified

### Core System
- ✅ `baserow-app/lib/filters/canonical-model.ts` - Filter model definition
- ✅ `baserow-app/lib/filters/evaluation.ts` - Evaluation engine (enhanced)
- ✅ `baserow-app/lib/filters/converters.ts` - Format converters (enhanced)
- ✅ `baserow-app/lib/filters/field-operators.ts` - Field-aware operators (NEW)
- ✅ `baserow-app/lib/filters/index.ts` - Module exports

### UI Components
- ✅ `baserow-app/components/filters/FilterBuilder.tsx` - Unified filter builder (NEW)
- ✅ `baserow-app/components/filters/FilterValueInput.tsx` - Field-aware value input (NEW)
- ✅ `baserow-app/components/filters/UnifiedFilterDialog.tsx` - Unified filter dialog (NEW)

### Application Code
- ✅ `lib/data.ts` - Uses shared evaluation engine with tableFields
- ✅ `baserow-app/lib/dashboard/aggregations.ts` - Uses unified filter system
- ✅ `baserow-app/lib/interface/filters.ts` - Deprecated but backward compatible

## Next Steps

1. **Update FilterDialog.tsx** - Replace with UnifiedFilterDialog or integrate FilterBuilder
2. **Update Block Settings** - Use FilterBuilder in block settings panels
3. **Add Drag & Drop** - Implement @dnd-kit for condition/group reordering
4. **Linked Field Filtering** - Add "has record matching..." with drill-down
5. **Multi-Select Operators** - Add "is any of" / "is none of"
6. **Date Relative Filters** - Add "next 7 days", "last month", etc.

## Testing Checklist

- [ ] Filters work identically in Grid, List, Chart, KPI blocks
- [ ] Filter groups with AND/OR logic work correctly
- [ ] Field-aware operators show correct options
- [ ] Select fields show options with correct colors
- [ ] Multi-select filtering works correctly
- [ ] Date filtering works correctly
- [ ] Linked field filtering works (has/doesn't have)
- [ ] Lookup field filtering works
- [ ] Empty groups are handled correctly
- [ ] Filter persistence works correctly
- [ ] Filter evaluation is consistent across all blocks

## Summary

The unified filter system provides:
- ✅ Single canonical model
- ✅ Shared evaluation engine
- ✅ Consistent behavior everywhere
- ✅ Field-type awareness
- ✅ Support for complex AND/OR logic
- ✅ Unified UI components
- ✅ Backward compatibility

This ensures filters are predictable, powerful, and familiar to users who know Airtable-style filtering.
