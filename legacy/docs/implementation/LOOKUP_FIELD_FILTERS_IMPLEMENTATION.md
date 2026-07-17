# Lookup Field Filters Implementation

## Overview

This document outlines the implementation of inline filters for lookup fields, allowing filters to be configured directly on the field rather than via table views. This approach aligns with Airtable's modern behavior and provides a more scalable, reusable solution.

---

## 1. Schema Extension

### 1.1 FieldOptions Interface Extension

Extend the `FieldOptions` interface in `baserow-app/types/fields.ts` to include filter configuration:

```typescript
export interface LookupFieldFilter {
  // Field in the lookup table to filter on
  field: string
  
  // Filter operator
  operator: 'equal' | 'not_equal' | 'contains' | 'not_contains' | 
            'greater_than' | 'less_than' | 'greater_than_or_equal' | 
            'less_than_or_equal' | 'is_empty' | 'is_not_empty' | 
            'date_range'
  
  // Value source type
  valueSource: 'static' | 'current_record' | 'context'
  
  // Static value (when valueSource === 'static')
  value?: any
  
  // Reference to current record field (when valueSource === 'current_record')
  // Format: field_name or field_id
  currentRecordField?: string
  
  // Context value type (when valueSource === 'context')
  // Options: 'current_user_id', 'current_user_email', 'current_date', etc.
  contextType?: 'current_user_id' | 'current_user_email' | 'current_date' | 'current_datetime'
  
  // Optional: Apply filter only when referenced field has a value
  // When true, skip this filter if the referenced field (currentRecordField) is null/empty
  applyOnlyWhenFieldHasValue?: boolean
  
  // For date_range operator
  value2?: any
  currentRecordField2?: string
  contextType2?: string
}

export interface FieldOptions {
  // ... existing options ...
  
  // For lookup fields
  lookup_table_id?: string
  lookup_field_id?: string
  lookup_result_field_id?: string
  
  // Lookup field display configuration
  primary_label_field?: string
  secondary_label_fields?: string[]
  relationship_type?: 'one-to-one' | 'one-to-many' | 'many-to-many'
  max_selections?: number
  allow_create?: boolean
  
  // NEW: Lookup field filters (array of filters with AND logic)
  lookup_filters?: LookupFieldFilter[]
}
```

### 1.2 Database Schema

No database migration is required. The filter configuration is stored in the existing `options` JSONB column of the `table_fields` table.

Example stored JSON:
```json
{
  "lookup_table_id": "uuid-here",
  "lookup_field_id": "uuid-here",
  "lookup_result_field_id": "uuid-here",
  "primary_label_field": "name",
  "lookup_filters": [
    {
      "field": "status",
      "operator": "equal",
      "valueSource": "static",
      "value": "active"
    },
    {
      "field": "company_id",
      "operator": "equal",
      "valueSource": "current_record",
      "currentRecordField": "company_id",
      "applyOnlyWhenFieldHasValue": true
    },
    {
      "field": "assigned_user_id",
      "operator": "equal",
      "valueSource": "context",
      "contextType": "current_user_id"
    }
  ]
}
```

---

## 2. Server-Side Query Logic

### 2.1 Filter Value Resolution

Create a utility function to resolve filter values based on their source type:

```typescript
// baserow-app/lib/lookups/resolveFilterValue.ts

import { createClient } from '@/lib/supabase/server'
import type { LookupFieldFilter } from '@/types/fields'

interface ResolveFilterValueContext {
  currentRecord?: Record<string, any> // Current record being edited/viewed
  currentUserId?: string // Current user ID from auth
  currentUserEmail?: string // Current user email from auth
}

/**
 * Resolves the value for a lookup field filter based on its valueSource
 */
export async function resolveFilterValue(
  filter: LookupFieldFilter,
  context: ResolveFilterValueContext
): Promise<{ value: any; value2?: any; shouldApply: boolean }> {
  const { currentRecord, currentUserId, currentUserEmail } = context
  
  // Check if filter should be skipped
  if (filter.applyOnlyWhenFieldHasValue && filter.valueSource === 'current_record') {
    const fieldValue = currentRecord?.[filter.currentRecordField || '']
    if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
      return { value: null, shouldApply: false }
    }
  }
  
  let value: any = null
  let value2: any = undefined
  
  switch (filter.valueSource) {
    case 'static':
      value = filter.value
      value2 = filter.value2
      break
      
    case 'current_record':
      if (!filter.currentRecordField) {
        return { value: null, shouldApply: false }
      }
      value = currentRecord?.[filter.currentRecordField]
      value2 = filter.currentRecordField2 ? currentRecord?.[filter.currentRecordField2] : undefined
      
      // Skip if value is null/empty (unless applyOnlyWhenFieldHasValue is false)
      if (!filter.applyOnlyWhenFieldHasValue && (value === null || value === undefined || value === '')) {
        return { value: null, shouldApply: false }
      }
      break
      
    case 'context':
      switch (filter.contextType) {
        case 'current_user_id':
          value = currentUserId
          break
        case 'current_user_email':
          value = currentUserEmail
          break
        case 'current_date':
          value = new Date().toISOString().split('T')[0] // YYYY-MM-DD
          break
        case 'current_datetime':
          value = new Date().toISOString()
          break
        default:
          return { value: null, shouldApply: false }
      }
      break
      
    default:
      return { value: null, shouldApply: false }
  }
  
  return { value, value2, shouldApply: true }
}
```

### 2.2 Apply Filters to Lookup Query

Create a function to apply lookup filters to a Supabase query:

```typescript
// baserow-app/lib/lookups/applyLookupFilters.ts

import type { SupabaseClient } from '@supabase/supabase-js'
import type { LookupFieldFilter } from '@/types/fields'
import { resolveFilterValue } from './resolveFilterValue'
import type { ResolveFilterValueContext } from './resolveFilterValue'

interface ApplyLookupFiltersOptions {
  query: any // Supabase query builder
  filters: LookupFieldFilter[]
  lookupTableFields: Array<{ name: string; type: string }> // Fields in lookup table
  context: ResolveFilterValueContext
}

/**
 * Applies lookup field filters to a Supabase query
 * Returns the modified query and information about active filters
 */
export async function applyLookupFilters(
  options: ApplyLookupFiltersOptions
): Promise<{
  query: any
  activeFilters: Array<{ filter: LookupFieldFilter; resolvedValue: any }>
  skippedFilters: LookupFieldFilter[]
}> {
  const { query, filters, lookupTableFields, context } = options
  
  if (!filters || filters.length === 0) {
    return { query, activeFilters: [], skippedFilters: [] }
  }
  
  const activeFilters: Array<{ filter: LookupFieldFilter; resolvedValue: any }> = []
  const skippedFilters: LookupFieldFilter[] = []
  
  for (const filter of filters) {
    // Resolve filter value
    const { value, value2, shouldApply } = await resolveFilterValue(filter, context)
    
    if (!shouldApply || value === null) {
      skippedFilters.push(filter)
      continue
    }
    
    // Validate field exists in lookup table
    const lookupField = lookupTableFields.find(f => f.name === filter.field)
    if (!lookupField) {
      console.warn(`Lookup filter field "${filter.field}" not found in lookup table`)
      skippedFilters.push(filter)
      continue
    }
    
    // Apply filter to query
    const fieldName = filter.field
    const fieldType = lookupField.type
    
    switch (filter.operator) {
      case 'equal':
        query = query.eq(fieldName, value)
        break
      case 'not_equal':
        query = query.neq(fieldName, value)
        break
      case 'contains':
        if (fieldType === 'text' || fieldType === 'long_text') {
          query = query.ilike(fieldName, `%${value}%`)
        } else {
          // For other types, convert to string for contains
          query = query.ilike(fieldName, `%${String(value)}%`)
        }
        break
      case 'not_contains':
        query = query.not(fieldName, 'ilike', `%${value}%`)
        break
      case 'greater_than':
        query = query.gt(fieldName, value)
        break
      case 'less_than':
        query = query.lt(fieldName, value)
        break
      case 'greater_than_or_equal':
        query = query.gte(fieldName, value)
        break
      case 'less_than_or_equal':
        query = query.lte(fieldName, value)
        break
      case 'is_empty':
        query = query.or(`${fieldName}.is.null,${fieldName}.eq.`)
        break
      case 'is_not_empty':
        query = query.not(fieldName, 'is', null)
        query = query.neq(fieldName, '')
        break
      case 'date_range':
        if (value && value2) {
          query = query.gte(fieldName, value).lte(fieldName, value2)
        } else if (value) {
          query = query.gte(fieldName, value)
        } else if (value2) {
          query = query.lte(fieldName, value2)
        }
        break
      default:
        console.warn(`Unknown lookup filter operator: ${filter.operator}`)
        skippedFilters.push(filter)
        continue
    }
    
    activeFilters.push({ filter, resolvedValue: value })
  }
  
  return { query, activeFilters, skippedFilters }
}
```

### 2.3 API Endpoint for Lookup Records

Create or update an API endpoint to fetch lookup records with filters applied:

```typescript
// baserow-app/app/api/tables/[tableId]/lookup-records/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { applyLookupFilters } from '@/lib/lookups/applyLookupFilters'
import type { LookupFieldFilter } from '@/types/fields'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const body = await request.json()
    
    const {
      lookupFieldId, // ID of the lookup field
      currentRecordId, // Optional: current record ID for dynamic values
      searchQuery, // Optional: search query
      limit = 50,
    } = body
    
    const supabase = await createClient()
    
    // Get lookup field configuration
    const { data: lookupField, error: fieldError } = await supabase
      .from('table_fields')
      .select('*')
      .eq('id', lookupFieldId)
      .eq('table_id', tableId)
      .single()
    
    if (fieldError || !lookupField || lookupField.type !== 'lookup') {
      return NextResponse.json(
        { error: 'Lookup field not found' },
        { status: 404 }
      )
    }
    
    const options = lookupField.options || {}
    const lookupTableId = options.lookup_table_id
    const filters: LookupFieldFilter[] = options.lookup_filters || []
    
    if (!lookupTableId) {
      return NextResponse.json(
        { error: 'Lookup table not configured' },
        { status: 400 }
      )
    }
    
    // Get lookup table info
    const { data: lookupTable, error: tableError } = await supabase
      .from('tables')
      .select('id, name, supabase_table')
      .eq('id', lookupTableId)
      .single()
    
    if (tableError || !lookupTable) {
      return NextResponse.json(
        { error: 'Lookup table not found' },
        { status: 404 }
      )
    }
    
    // Get lookup table fields
    const { data: lookupTableFields, error: fieldsError } = await supabase
      .from('table_fields')
      .select('name, type')
      .eq('table_id', lookupTableId)
    
    if (fieldsError || !lookupTableFields) {
      return NextResponse.json(
        { error: 'Failed to load lookup table fields' },
        { status: 500 }
      )
    }
    
    // Get current record if provided
    let currentRecord: Record<string, any> | undefined
    if (currentRecordId) {
      const { data: table } = await supabase
        .from('tables')
        .select('supabase_table')
        .eq('id', tableId)
        .single()
      
      if (table) {
        const { data: record } = await supabase
          .from(table.supabase_table)
          .select('*')
          .eq('id', currentRecordId)
          .single()
        
        currentRecord = record || undefined
      }
    }
    
    // Get current user info
    const { data: { user } } = await supabase.auth.getUser()
    const currentUserId = user?.id
    const currentUserEmail = user?.email
    
    // Build base query
    const primaryLabelField = options.primary_label_field || 'name'
    const secondaryLabelFields = options.secondary_label_fields || []
    const fieldsToSelect = [
      'id',
      primaryLabelField,
      ...secondaryLabelFields.slice(0, 2),
    ].filter(Boolean)
    
    let query = supabase
      .from(lookupTable.supabase_table)
      .select(fieldsToSelect.join(', '))
      .limit(limit)
    
    // Apply filters
    const filterResult = await applyLookupFilters({
      query,
      filters,
      lookupTableFields,
      context: {
        currentRecord,
        currentUserId,
        currentUserEmail,
      },
    })
    
    query = filterResult.query
    
    // Apply search query if provided
    if (searchQuery && searchQuery.trim()) {
      const primaryField = lookupTableFields.find(f => f.name === primaryLabelField)
      if (primaryField && (primaryField.type === 'text' || primaryField.type === 'long_text')) {
        query = query.ilike(primaryLabelField, `%${searchQuery}%`)
      }
    }
    
    // Execute query
    const { data: records, error: queryError } = await query
    
    if (queryError) {
      return NextResponse.json(
        { error: queryError.message },
        { status: 500 }
      )
    }
    
    // Return results with filter information
    return NextResponse.json({
      records: records || [],
      activeFilters: filterResult.activeFilters.map(f => ({
        field: f.filter.field,
        operator: f.filter.operator,
        value: f.resolvedValue,
      })),
      skippedFilters: filterResult.skippedFilters.length,
    })
  } catch (error: any) {
    console.error('Error fetching lookup records:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch lookup records' },
      { status: 500 }
    )
  }
}
```

---

## 3. UX for Configuring Filters

### 3.1 Filter Configuration UI

Add a filter configuration section to the Field Settings Drawer when editing a lookup field:

**Location:** `baserow-app/components/layout/FieldSettingsDrawer.tsx`

**Key UI Components:**

1. **Filter List Section**
   - Show existing filters in a list
   - Each filter shows: Field name, Operator, Value source, Value
   - Edit/Delete buttons for each filter
   - "Add Filter" button

2. **Filter Editor Dialog**
   - Field selector (dropdown of fields in lookup table)
   - Operator selector (dropdown)
   - Value source selector (radio/tabs: Static, Current Record, Context)
   - Value input (conditional based on value source):
     - Static: Direct input
     - Current Record: Field selector from current table
     - Context: Context type selector (Current User ID, Current User Email, Current Date, etc.)
   - "Apply only when referenced field has value" checkbox (when using Current Record)
   - Preview of resolved value (if possible)

3. **Filter Status Display**
   - Show which filters are active
   - Explain why filters might be skipped (e.g., "Company ID filter skipped because current record has no Company ID")

### 3.2 Example UI Structure

```tsx
// In FieldSettingsDrawer.tsx, add for lookup fields:

{type === 'lookup' && (
  <div className="space-y-4 border-t pt-4">
    <div className="flex items-center justify-between">
      <div>
        <Label>Lookup Filters</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Filters are applied when fetching lookup records. All filters use AND logic.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShowFilterDialog(true)}
      >
        <Plus className="h-4 w-4 mr-1" />
        Add Filter
      </Button>
    </div>
    
    {lookupFilters.length === 0 ? (
      <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
        No filters configured. All records from the lookup table will be available.
      </div>
    ) : (
      <div className="space-y-2">
        {lookupFilters.map((filter, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 border rounded-md bg-muted/50"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{filter.field}</span>
                <Badge variant="outline" className="text-xs">
                  {filter.operator.replace(/_/g, ' ')}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {filter.valueSource === 'static' && 'Static'}
                  {filter.valueSource === 'current_record' && 'From Record'}
                  {filter.valueSource === 'context' && 'Context'}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {filter.valueSource === 'static' && String(filter.value)}
                {filter.valueSource === 'current_record' && `Current record: ${filter.currentRecordField}`}
                {filter.valueSource === 'context' && filter.contextType?.replace(/_/g, ' ')}
                {filter.applyOnlyWhenFieldHasValue && ' (only when field has value)'}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleEditFilter(index)}
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveFilter(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

### 3.3 Displaying Filter Status

When displaying lookup results (e.g., in LookupFieldPicker), show why records might be filtered:

```tsx
// In LookupFieldPicker component, when no results:

{records.length === 0 && (
  <div className="p-4 text-center text-sm text-muted-foreground">
    <p className="font-medium mb-2">No records found</p>
    {activeFilters.length > 0 && (
      <div className="mt-2 space-y-1">
        <p className="text-xs">Active filters:</p>
        {activeFilters.map((filter, idx) => (
          <div key={idx} className="text-xs">
            {filter.field} {filter.operator} {String(filter.value)}
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

---

## 4. Implementation Notes

### 4.1 Filter Application Order

1. Filters are applied in the order they appear in the `lookup_filters` array
2. All filters use AND logic (all must pass)
3. Filters are evaluated before search queries are applied

### 4.2 Performance Considerations

- Filters are applied server-side for efficiency
- Consider caching resolved filter values when appropriate
- Index lookup table fields that are commonly used in filters
- Limit the number of filters per lookup field (recommend max 10)

### 4.3 Migration Path

For existing lookup fields:
- `lookup_filters` is optional (defaults to empty array)
- Existing lookup fields without filters continue to work as before
- Filters can be added incrementally without breaking existing functionality

### 4.4 Error Handling

- If a filter field is deleted from the lookup table, skip that filter and log a warning
- If a current record field is deleted, skip filters using it and log a warning
- If filter value cannot be resolved, skip that filter (don't break the query)

### 4.5 Testing Considerations

Test cases:
1. Static value filters (all operators)
2. Current record filters (with and without `applyOnlyWhenFieldHasValue`)
3. Context filters (all context types)
4. Multiple filters with AND logic
5. Filters with missing/invalid field references
6. Filters with null/empty values
7. Date range filters
8. Filters combined with search queries

---

## 5. Example Usage

### 5.1 Example 1: Active Records Only

```json
{
  "lookup_filters": [
    {
      "field": "status",
      "operator": "equal",
      "valueSource": "static",
      "value": "active"
    }
  ]
}
```

### 5.2 Example 2: Records from Same Company

```json
{
  "lookup_filters": [
    {
      "field": "company_id",
      "operator": "equal",
      "valueSource": "current_record",
      "currentRecordField": "company_id",
      "applyOnlyWhenFieldHasValue": true
    }
  ]
}
```

### 5.3 Example 3: User's Assigned Records

```json
{
  "lookup_filters": [
    {
      "field": "assigned_user_id",
      "operator": "equal",
      "valueSource": "context",
      "contextType": "current_user_id"
    },
    {
      "field": "archived",
      "operator": "equal",
      "valueSource": "static",
      "value": false
    }
  ]
}
```

### 5.4 Example 4: Complex Filter

```json
{
  "lookup_filters": [
    {
      "field": "status",
      "operator": "equal",
      "valueSource": "static",
      "value": "active"
    },
    {
      "field": "company_id",
      "operator": "equal",
      "valueSource": "current_record",
      "currentRecordField": "company_id",
      "applyOnlyWhenFieldHasValue": true
    },
    {
      "field": "due_date",
      "operator": "greater_than_or_equal",
      "valueSource": "context",
      "contextType": "current_date"
    }
  ]
}
```

---

## 6. Next Steps

1. **Implement Schema Extension**
   - Update `FieldOptions` interface in `types/fields.ts`
   - Add `LookupFieldFilter` interface

2. **Create Filter Resolution Logic**
   - Implement `resolveFilterValue` function
   - Implement `applyLookupFilters` function

3. **Update API Endpoints**
   - Create `/api/tables/[tableId]/lookup-records` endpoint
   - Update existing lookup value computation logic

4. **Build UI Components**
   - Add filter configuration to Field Settings Drawer
   - Create Filter Editor Dialog component
   - Update LookupFieldPicker to show filter status

5. **Testing**
   - Unit tests for filter resolution
   - Integration tests for API endpoints
   - UI tests for filter configuration

6. **Documentation**
   - User-facing documentation
   - Developer documentation
   - Migration guide (if needed)
