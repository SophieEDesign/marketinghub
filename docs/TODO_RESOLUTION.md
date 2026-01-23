# TODO Resolution Summary

## Overview

This document categorizes and tracks all TODO/FIXME comments found in the codebase, providing implementation plans and priorities.

**Total TODOs Found**: 27 (down from 211 mentioned in original audit - many already resolved)

**Last Updated**: 2026-01-23

## Summary by Priority

- **High Priority**: 18 TODOs (Core grid view features)
- **Medium Priority**: 5 TODOs (Performance and feature enhancements)
- **Low Priority**: 4 TODOs (UI polish and convenience features)

## High Priority - Feature Implementation

### Grid View Column Operations

These are core grid view features that users expect. The backend services exist but need to be connected to the UI handlers.

#### Location: `baserow-app/components/grid/GridView.tsx`

| Line | TODO | Status | Implementation Notes |
|------|------|--------|---------------------|
| 2201 | Implement column-level sort (currently handled by toolbar) | **✅ Resolved** | Removed obsolete TODO - functionality handled by toolbar |
| 2206 | Implement column-level filter (currently handled by toolbar) | **✅ Resolved** | Removed obsolete TODO - functionality handled by toolbar |
| 2211 | Implement column-level group (currently handled by toolbar) | **✅ Resolved** | Removed obsolete TODO - functionality handled by toolbar |
| 2216 | Implement column hide/show | **✅ Implemented** | Implemented: Toggles `view_fields.visible` via Supabase update |
| 2221 | Implement column duplicate | **✅ Implemented** | Creates duplicate field via POST API endpoint with same properties |
| 2226 | Implement insert column left | **✅ Partially Implemented** | Opens field builder - full auto-positioning requires field builder coordination |
| 2231 | Implement insert column right | **✅ Partially Implemented** | Opens field builder - full auto-positioning requires field builder coordination |
| 2236 | Implement column delete | **✅ Implemented** | Implemented: Connects to DELETE `/api/tables/[tableId]/fields` endpoint |
| 2251 | Open field description editor | **Partially Implemented** | `onEditField` is called but description editing not implemented |
| 2256 | Open field permissions editor | **Needs Implementation** | Field permissions UI not yet implemented |
| 2261 | Change primary field | **Needs Implementation** | Primary field management not yet implemented |
| 2710 | Implement select all functionality | **Needs Implementation** | See `AirtableGridView.tsx` for reference implementation |

#### Location: `baserow-app/components/grid/GridColumnHeader.tsx`

| Line | TODO | Status | Implementation Notes |
|------|------|--------|---------------------|
| 246 | Implement duplicate field | **✅ Implemented** | Connected to `handleColumnDuplicate` in GridView |
| 290 | Edit field description | **Needs Implementation** | Add description field to field settings |
| 298 | Edit field permissions | **Needs Implementation** | Field permissions UI not yet implemented |
| 319 | Filter by this field | **✅ Implemented** | Creates filter with field pre-selected via `onFilterCreate` callback |
| 327 | Group by this field | **✅ Implemented** | Sets groupBy via `onGroupByChange` callback (toggles if already grouped) |
| 335 | Hide field | **✅ Implemented** | Connected to `handleColumnHide` in GridView |
| 347 | Delete field | **✅ Implemented** | Connected to `handleColumnDelete` in GridView |

**Implementation Priority**: These features should be prioritized for the next major release as they are core grid view functionality.

## Medium Priority - Enhancements

### View Metadata Cache Invalidation

#### Location: `baserow-app/app/api/tables/[tableId]/fields/route.ts`

| Line | TODO | Status | Implementation Notes |
|------|------|--------|---------------------|
| 527 | Invalidate view metadata cache when fields change (POST) | **Documented** | `clearViewMetaCache` function exists in `useViewMeta.ts`. See `docs/guides/PRE_DEPLOY_CHECKLIST.md` for implementation options. Low priority - cache expires in 5 minutes. |
| 794 | Invalidate view metadata cache when fields change (PATCH) | **Documented** | Same as above |
| 1150 | Invalidate view metadata cache when fields change (DELETE) | **Documented** | Same as above |

**Implementation**: Uncomment the code and import `clearViewMetaCache`:
```typescript
import { clearViewMetaCache } from '@/hooks/useViewMeta'
// After successful mutation:
clearViewMetaCache(undefined, params.tableId) // Clear all views for this table
```

**Priority**: Low (cache expires in 5 minutes anyway, and page refresh clears it)

### SQL Views Query

#### Location: `baserow-app/app/api/sql-views/route.ts`

| Line | TODO | Status | Implementation Notes |
|------|------|--------|---------------------|
| 11 | Query information_schema.views to get actual SQL views | **Needs Implementation** | Implement SQL query to fetch views from PostgreSQL information_schema |

**Implementation**:
```typescript
const { data, error } = await supabase.rpc('execute_sql_safe', {
  sql_text: `
    SELECT table_name 
    FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name LIKE 'view_%'
  `
})
```

### Linked Record Filtering

#### Location: `baserow-app/lib/filters/evaluation.ts`

| Line | TODO | Status | Implementation Notes |
|------|------|--------|---------------------|
| 396 | Implement linked record filtering with drill-down | **Needs Implementation** | Advanced filtering feature - requires table relationship info |
| 405 | Implement linked record filtering with drill-down | **Needs Implementation** | Same as above |

**Implementation**: Requires:
- Linked table relationship information
- Subquery support in filter evaluation
- Drill-down UI for linked record conditions

## Low Priority - UI Polish

### View Settings

#### Location: `baserow-app/components/grid/AirtableViewPage.tsx`

| Line | TODO | Status | Implementation Notes |
|------|------|--------|---------------------|
| 363 | Implement set as default | **Needs Implementation** | UI convenience feature - set view as default for table |

**Implementation**: Update `views` table to set `is_default = true` for the selected view.

### JSONB Filtering

#### Location: `lib/data.ts`

| Line | TODO | Status | Implementation Notes |
|------|------|--------|---------------------|
| 194 | Implement proper JSONB filtering in Supabase query | **Needs Implementation** | Currently filters client-side. Move to server-side for performance. |

**Implementation**: Use Supabase JSONB operators in PostgREST queries:
```typescript
// Example for JSONB field filtering
query = query.contains('jsonb_field', { key: 'value' })
```

## Implementation Recommendations

### Immediate Actions (High Impact, Low Risk)

1. **Remove Obsolete TODOs** (Lines 2201, 2206, 2211 in GridView.tsx)
   - These features are already implemented via toolbar
   - Action: Remove TODO comments

2. **Connect Existing Services to UI** (High Priority Grid Features)
   - Field duplication: Connect `DataViewService.duplicateColumn()` to `handleColumnDuplicate`
   - Field deletion: Connect DELETE endpoint to `handleColumnDelete`
   - Column hide/show: Implement `view_fields.visible` toggle

3. **Implement Select All** (Line 2710)
   - Reference: `AirtableGridView.tsx` has working implementation
   - Action: Port implementation to `GridView.tsx`

### Short Term (Next Sprint)

1. **Field Operations** (Insert left/right, hide/show, delete)
   - These are core grid features users expect
   - Backend APIs exist, need UI connection

2. **Field Description Editing**
   - Add description field to field settings drawer
   - Store in `table_fields.options.description`

### Medium Term

1. **Cache Invalidation** (3 TODOs in fields route)
   - Low priority but easy to implement
   - Uncomment existing code

2. **Field Permissions**
   - Requires permissions system design
   - May need new database schema

3. **Primary Field Management**
   - Requires table-level settings
   - May need new database schema

### Long Term

1. **Linked Record Filtering**
   - Complex feature requiring relationship management
   - Consider as part of larger relationship feature set

2. **SQL Views Query**
   - Feature enhancement for SQL view support
   - Low user impact

## GitHub Issues Template

For tracking purposes, high-priority TODOs should be converted to GitHub issues. Use this template:

```markdown
## Grid View Feature: [Feature Name]

**Priority**: High
**Component**: `baserow-app/components/grid/GridView.tsx`
**Line**: [Line Number]

### Description
[Feature description]

### Implementation Plan
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Related Code
- Handler: `handleColumn[Feature]()` at line [X]
- Backend: [API endpoint or service method]
- Reference: [Similar implementation if exists]

### Acceptance Criteria
- [ ] Feature works as expected
- [ ] Error handling implemented
- [ ] UI feedback provided
- [ ] Tests added (if applicable)
```

## Notes

- Most TODOs are well-documented with clear intent
- No obsolete or unclear TODOs found (except the 3 toolbar-related ones)
- All TODOs represent legitimate future work
- Backend services exist for many features - mainly need UI connection
- Consider converting high-priority TODOs to GitHub issues for tracking

## Tracking

- **Total TODOs**: 27
- **Resolved**: 13 (3 obsolete TODOs removed, 10 features implemented/partially implemented)
- **In Progress**: 0
- **Pending**: 14

### Recently Resolved (2026-01-23)

1. **Removed 3 obsolete TODOs** in `GridView.tsx` (lines 2201, 2206, 2211)
   - Sort, filter, and group operations are handled by Toolbar component
   - Updated comments to clarify future enhancement possibilities

2. **Implemented column hide/show** (line 2216 in GridView.tsx, line 335 in GridColumnHeader.tsx)
   - Toggles `view_fields.visible` via Supabase update
   - Connected to UI handlers in both GridView and GridColumnHeader

3. **Implemented field deletion** (line 2236 in GridView.tsx, line 347 in GridColumnHeader.tsx)
   - Connects to DELETE `/api/tables/[tableId]/fields` endpoint
   - Includes confirmation dialog and error handling
   - Connected to UI handlers in both GridView and GridColumnHeader

4. **Implemented "Filter by this field"** (line 319 in GridColumnHeader.tsx, line 2205 in GridView.tsx)
   - Creates a filter with the field pre-selected
   - Uses `onFilterCreate` callback passed from GridViewWrapper
   - Creates default "is not empty" filter (user can modify in filter editor)

5. **Implemented "Group by this field"** (line 327 in GridColumnHeader.tsx, line 2210 in GridView.tsx)
   - Sets groupBy to the selected field via `onGroupByChange` callback
   - Toggles grouping: if already grouped by this field, ungroups; otherwise groups by it
   - Connected to GridViewWrapper's groupBy management

6. **Implemented column duplicate** (line 2221 in GridView.tsx, line 246 in GridColumnHeader.tsx)
   - Creates duplicate field via POST `/api/tables/[tableId]/fields` endpoint
   - Generates unique name (fieldName_copy, fieldName_copy_1, etc.)
   - Copies all field properties (type, options, required, default_value)
   - Prevents duplication of formula fields (read-only)
   - Connected to UI handlers in both GridView and GridColumnHeader

7. **Implemented insert column left/right** (lines 2226, 2231 in GridView.tsx)
   - Opens field builder modal for creating new field
   - Basic implementation: opens builder, user positions manually after creation
   - Future enhancement: Auto-position after field creation (requires field builder coordination)

---

**Next Review**: After implementing high-priority items, update this document with resolution status.
