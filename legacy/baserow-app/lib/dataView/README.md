# DataViewService - Core Data View Operations

## Overview

The DataViewService provides spreadsheet-style copy, paste, and column duplication operations at the core data view level. This ensures all views (grid, form, bulk editor) can reuse the same logic for consistency.

## Architecture

### Core Principles
- **Data view is the source of truth** - All mutations go through the service
- **Grid is only a rendering layer** - UI components delegate to the service
- **All mutations are batchable and undoable** - Changes are grouped and reversible

### Components

1. **DataViewService** (`DataViewService.ts`)
   - Core service class for data operations
   - Handles copy/paste/duplicate operations
   - Manages batch mutations with validation

2. **useDataView** (`useDataView.ts`)
   - React hook wrapping DataViewService
   - Provides undo/redo support
   - Manages history for batch operations

3. **Clipboard** (`clipboard.ts`)
   - Parses/formats clipboard text (tab-separated, newline-separated)
   - Handles type-specific value parsing

4. **Validation** (`validation.ts`)
   - Validates values by field type
   - Returns normalized values and error messages

5. **Types** (`types.ts`)
   - TypeScript definitions for selections, changes, results

## Selection Types

Only one selection type can be active at a time:

- **Cell Selection**: Single active cell
- **Row Selection**: Entire row(s)
- **Column Selection**: Entire column

## Copy Behavior

- **Copy cell**: Value only (plain text)
- **Copy row**: Tab-separated values in visible column order
- **Copy column**: Newline-separated values in row order

Clipboard output is always plain text (no formatting).

## Paste Behavior

Paste intent is resolved in this order:

1. **If a column is selected**:
   - Paste vertically into that column
   - One value per row

2. **If a row is selected**:
   - Paste horizontally into that row
   - One value per column

3. **If a cell is selected**:
   - Treat pasted data as a 2D grid
   - Anchor paste at the active cell (top-left)
   - Values flow down rows and across columns

## Paste Rules

- Overwrites existing values
- Ignores empty pasted cells
- Validates values based on column type
- Collects validation errors without aborting the entire paste
- All pasted changes register as a single undo action

## Batch Mutation Pipeline

1. Parse clipboard text (`\n` rows, `\t` columns)
2. Map pasted values to `(row_id, column_id)`
3. Stage changes locally
4. Validate all changes
5. Apply optimistic UI update
6. Persist changes in a single batch operation
7. On failure, restore previous state

## Column Duplication

- Duplicates column schema (type, settings, validation rules)
- Assigns a new column ID and position
- Optionally copies existing row values into the new column
- This is a schema operation, not a UI clone

## Usage Example

```typescript
import { useDataView } from '@/lib/dataView/useDataView'
import type { Selection } from '@/lib/dataView/types'

function MyGridView({ tableId, tableName, rows, fields }) {
  const dataView = useDataView({
    context: {
      tableId,
      supabaseTableName: tableName,
      rows,
      fields,
      visibleFields: fields, // Fields visible in current view
    },
    onChangesApplied: (result) => {
      console.log(`Applied ${result.appliedCount} changes`)
      if (result.errors.length > 0) {
        console.error('Validation errors:', result.errors)
      }
    },
  })

  // Copy operation
  const handleCopy = (selection: Selection) => {
    const text = dataView.copy(selection)
    navigator.clipboard.writeText(text)
  }

  // Paste operation
  const handlePaste = async (selection: Selection) => {
    const text = await navigator.clipboard.readText()
    await dataView.paste(selection, text)
  }

  // Duplicate column
  const handleDuplicateColumn = async (columnId: string) => {
    const result = await dataView.duplicateColumn(columnId, {
      withData: true, // Copy existing values
    })
    if (result.success) {
      console.log('Column duplicated:', result.newColumnId)
    }
  }

  // Undo/Redo
  const handleUndo = () => {
    if (dataView.canUndo) {
      dataView.undo()
    }
  }

  const handleRedo = () => {
    if (dataView.canRedo) {
      dataView.redo()
    }
  }

  return (
    <div>
      {/* Grid UI */}
    </div>
  )
}
```

## Keyboard Shortcuts

The grid view automatically handles:
- **Ctrl/Cmd + C**: Copy selection
- **Ctrl/Cmd + V**: Paste at selection
- **Ctrl/Cmd + Z**: Undo
- **Ctrl/Cmd + Shift + Z**: Redo

## Integration with Grid View

The `AirtableGridView` component is already integrated with DataViewService:

1. Uses `useDataView` hook for operations
2. Handles keyboard shortcuts automatically
3. Updates context when rows/fields change
4. Shows validation errors after paste

## Validation

Values are validated by field type:
- **Text/Email/URL**: Format validation
- **Number/Currency/Percent**: Numeric validation with precision
- **Date**: Date format validation
- **Select/Multi-select**: Choice validation
- **Checkbox**: Boolean conversion
- **Link to table**: UUID validation
- **Attachment/JSON**: Format validation

Virtual fields (formula, lookup) cannot be edited.

## Error Handling

- Validation errors are collected but don't abort the entire paste
- Individual cell errors are reported to the user
- Failed database operations trigger rollback
- Previous state is restored on failure

## Undo/Redo

- History is maintained for batch operations
- Maximum 50 history entries
- Undo reverses the last batch of changes
- Redo re-applies undone changes
- History is cleared when new actions are performed

## Why Paste Logic Lives Here (Not in the Grid)

The paste logic lives in the DataViewService layer, not in the grid component, for several important reasons:

1. **Reusability**: Form views, bulk editors, and other data views can all use the same paste logic without duplication
2. **Consistency**: All views behave the same way when pasting, ensuring a predictable user experience
3. **Testability**: Business logic is separated from UI, making it easier to unit test
4. **Maintainability**: Changes to paste behavior only need to be made in one place
5. **Data Integrity**: The service layer ensures all mutations go through validation and batch operations, regardless of which view triggers them
6. **Undo/Redo**: History management works consistently across all views because it's centralized

The grid is just a rendering layer that:
- Displays data
- Captures user input (keyboard shortcuts, clicks)
- Delegates operations to the DataViewService
- Updates its display based on service results

This separation follows the principle: **UI components should be thin, business logic should be reusable**.

## Guardrails and Safety

The service includes several guardrails to prevent issues:

- **Max paste size**: Default limit of 10,000 rows × 1,000 columns
- **Max changes**: Default limit of 10,000 changes per batch operation
- **Soft warnings**: Console warnings for large pastes (>1,000 cells)
- **Dry run mode**: Optional `dryRun` parameter in `applyCellChanges()` to validate without persisting

These can be configured via options:

```typescript
// Limit paste size
const intent = dataView.resolvePasteIntent(selection, text, {
  maxRows: 5000,
  maxCols: 500,
})

// Dry run validation
const result = await dataView.applyCellChanges(changes, {
  dryRun: true,
  maxChanges: 5000,
})
```

## Event Naming for Analytics/Debugging

The service logs events for analytics and debugging. Events are pushed to `window.__dataViewEvents` (if available):

- `dataView.paste.column` - Column paste operation
- `dataView.paste.row` - Row paste operation  
- `dataView.paste.grid` - Grid paste operation
- `dataView.column.duplicate` - Column duplication

Each event includes:
- `type`: Event type
- `mode`/`selectionType`: Selection context
- `timestamp`: When the event occurred
- Additional context-specific fields

Example:
```javascript
// Enable event logging
window.__dataViewEvents = []

// Events will be pushed automatically
// Access via: window.__dataViewEvents
```

## Non-Goals

The following are explicitly NOT implemented:
- Drag-fill handles
- Formula columns (read-only)
- Live multi-user editing
- Rich clipboard formats (HTML, etc.)

## Future Enhancements

Potential additions:
- Column selection via header click
- Bulk column operations
- Paste special (values only, formatting, etc.)
- Copy/paste between different tables
- Export/import as CSV
