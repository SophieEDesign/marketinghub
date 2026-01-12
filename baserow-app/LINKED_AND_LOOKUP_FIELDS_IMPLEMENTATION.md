# Linked and Lookup Fields Implementation

## Overview

This document describes the implementation of Linked (relationship) fields and Lookup (derived) fields in the data view layer. These field types enable relationships between tables and computed display values.

## Core Principles

1. **Data view is the source of truth**: All mutations flow through `DataViewService`
2. **Linked fields store IDs only**: Never store display values, only record IDs
3. **Lookup fields are read-only**: Computed at runtime, never persisted
4. **Clear separation**: Linked fields are editable, lookup fields are not

## Type Definitions

### LinkedField

```typescript
interface LinkedField extends TableField {
  type: 'link_to_table'
  options: {
    linked_table_id: string  // Required: target table ID
    linked_field_id?: string  // Optional: field in target table
    primary_label_field?: string  // Field to use for display
    relationship_type?: 'one-to-one' | 'one-to-many' | 'many-to-many'
  }
}
```

**Value Format:**
- Single link: `string` (UUID)
- Multi-link: `string[]` (array of UUIDs)

**Behavior:**
- Editable and participates in batch updates
- Can be copied (uses display labels)
- Can be pasted (resolves display names to IDs)
- Supports undo/redo

### LookupField

```typescript
interface LookupField extends TableField {
  type: 'lookup'
  options: {
    lookup_table_id: string  // Required: table to lookup from
    lookup_field_id: string  // Required: linked field this depends on
    lookup_result_field_id: string  // Required: field to display
  }
}
```

**Value Format:**
- Computed at runtime
- Never stored in database
- Type depends on `lookup_result_field_id` in target table

**Behavior:**
- Always read-only
- Excluded from all mutation pipelines
- Rejects paste attempts with clear error
- Recomputes when linked data changes

## Implementation Details

### 1. Type Guards

Located in `baserow-app/types/fields.ts`:

```typescript
function isLinkedField(field: TableField): field is LinkedField
function isLookupField(field: TableField): field is LookupField
```

### 2. Linked Field Utilities

Located in `baserow-app/lib/dataView/linkedFields.ts`:

#### `resolveLinkedFieldDisplay(field, value)`
Resolves linked field IDs to display labels for copy operations.

- Handles single and multi-link values
- Uses `primary_label_field` if configured, otherwise falls back to first text field
- Returns comma-separated string for multi-link

#### `resolvePastedLinkedValue(field, pastedText)`
Resolves pasted text (display names or IDs) to record IDs.

- Accepts comma or newline-separated values
- First checks if text is already a UUID
- Searches target table by display name across text fields
- Validates single-link constraint (rejects multiple values for single-link)
- Returns resolved IDs with any errors

### 3. Clipboard Handling

Located in `baserow-app/lib/dataView/clipboard.ts`:

#### Copy
- Linked fields: Returns IDs (display resolution happens in `DataViewService.copyWithDisplayResolution()`)
- Lookup fields: Returns computed display values

#### Paste
- Linked fields: Returns raw text (resolution happens in validation)
- Lookup fields: Explicitly rejects (returns `null`)

### 4. Validation

Located in `baserow-app/lib/dataView/validation.ts`:

#### `validateLinkToTable(field, value)`
- Validates UUID format for single link
- Validates array of UUIDs for multi-link
- Returns error for non-UUID strings (triggers async resolution)

#### `validatePastedLinkedValue(field, pastedValue)`
- Async function that resolves display names to IDs
- Called from `DataViewService.applyCellChanges()` for linked fields
- Returns validation result with resolved IDs

### 5. DataViewService Updates

Located in `baserow-app/lib/dataView/DataViewService.ts`:

#### `copy(selection)`
- Synchronous copy operation
- For linked fields, uses `formatCellValue()` with field context
- Returns IDs (display resolution available via `copyWithDisplayResolution()`)

#### `copyWithDisplayResolution(selection)`
- Async version that resolves linked field IDs to display labels
- Use this when clipboard needs display names

#### `resolvePasteIntent(selection, clipboardText)`
- Rejects paste into lookup fields with clear error message
- Skips lookup fields in grid paste operations
- Returns warnings for skipped lookup fields

#### `applyCellChanges(changes)`
- Excludes lookup fields from mutations (returns error)
- Excludes formula fields from mutations (returns error)
- For linked fields with non-UUID values, calls `validatePastedLinkedValue()` to resolve
- Validates resolved IDs before applying

#### `duplicateColumn(columnId, options)`
- Rejects duplication of lookup fields (read-only, computed)
- Rejects duplication of formula fields (read-only, computed)
- For linked fields: duplicates schema and optionally copies linked values (IDs)
- Preserves target table configuration

## Paste Rules

### Linked Fields
**Accept:**
- Record IDs (UUID format)
- Display names (resolved to IDs)
- Comma or newline-separated values (for multi-link)

**Validation:**
- UUIDs are validated against target table
- Display names are searched across text fields in target table
- Ambiguous matches (multiple records) are rejected
- Single-link fields reject multiple values

### Lookup Fields
**Reject:**
- All paste attempts
- Error message: "Cannot paste into lookup field [name] (read-only)"

## Column Duplication Rules

### Linked Field
1. Duplicate schema (field metadata)
2. Preserve `linked_table_id` and `linked_field_id`
3. Add physical column to table (TEXT type for UUID storage)
4. Optionally copy linked values (IDs) if `withData: true`

### Lookup Field
1. **Cannot be duplicated** (returns error)
2. Error message: "Cannot duplicate lookup field [name] (read-only, computed). Duplicate the linked field it depends on instead."

## Integration Points

### Grid View
- Uses `DataViewService` for all copy/paste operations
- Calls `copyWithDisplayResolution()` for linked field copy
- Handles paste rejection for lookup fields gracefully

### Record Panel
- Displays linked field values using display resolution
- Shows lookup field computed values
- Prevents editing of lookup fields

### Bulk Editor
- Excludes lookup fields from bulk edit operations
- Supports linked field bulk updates (with ID resolution)

## Error Handling

### Linked Field Paste Errors
- "No record found matching [name]"
- "Ambiguous match for [name]: found N records"
- "Single-link field cannot accept multiple values"
- "Record ID [id] not found in target table"

### Lookup Field Errors
- "Cannot paste into lookup field [name] (read-only)"
- "Field [name] is a lookup field (read-only) and cannot be edited"
- "Cannot duplicate lookup field [name] (read-only, computed)"

## Testing Considerations

1. **Linked Field Copy/Paste:**
   - Copy single link (should use display label)
   - Copy multi-link (should use comma-separated labels)
   - Paste UUID (should validate and accept)
   - Paste display name (should resolve to ID)
   - Paste multiple values into single-link (should reject)
   - Paste ambiguous name (should reject)

2. **Lookup Field Protection:**
   - Attempt paste into lookup field (should reject)
   - Attempt edit lookup field (should reject)
   - Attempt duplicate lookup field (should reject)

3. **Column Duplication:**
   - Duplicate linked field with data (should copy IDs)
   - Duplicate linked field without data (should only copy schema)
   - Attempt duplicate lookup field (should reject)

## Future Enhancements

1. **Performance:**
   - Cache display name resolutions
   - Batch resolve multiple linked field values
   - Pre-resolve display names in view layer

2. **UX:**
   - Show lookup field dependencies in field settings
   - Warn when deleting linked field that lookup depends on
   - Auto-suggest display names when pasting into linked fields

3. **Validation:**
   - Validate linked field target table exists
   - Validate lookup field dependencies
   - Check for circular dependencies
