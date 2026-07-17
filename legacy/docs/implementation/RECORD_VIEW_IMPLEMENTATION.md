# Record View with Blocks + Field Table Implementation

## Overview

This implementation provides a Record View system that combines:
1. **Record Field Panel** - A structured table-style display of selected fields
2. **Block Canvas** - A flexible layout for blocks (text, related records, embeds, etc.)

This creates a unified interface similar to Airtable's record details panel, but with extensible blocks.

## Components Created

### 1. RecordFieldPanel (`baserow-app/components/records/RecordFieldPanel.tsx`)

A structured field display component that:
- Shows selected fields in a table-style layout (field name | field value)
- Supports inline editing (if permitted)
- Handles field permissions (read-only, editable, hidden)
- Supports both compact (table) and standard (card) display modes

**Props:**
- `tableId`: The table ID
- `recordId`: The current record ID
- `fields`: Array of field configurations (field name/id, editable flag, order)
- `allFields`: All available fields from the table
- `onFieldChange`: Callback when a field value changes
- `compact`: Whether to use compact table view

### 2. RelatedRecordsListBlock (`baserow-app/components/interface/blocks/RelatedRecordsListBlock.tsx`)

A new block type that displays related records from a linked table:
- Shows records filtered by a link field
- Supports different display modes: compact, table, cards
- Clicking a record opens its Record View
- Supports filters and permissions (create, delete, open)

**Configuration:**
- `table_id` / `related_table_id`: The related table ID
- `link_field_name`: Field name in related table that links back to current record
- `display_mode`: "compact" | "table" | "cards"
- `filters`: Array of filter configurations
- `permissions`: Object with `allowInlineCreate`, `allowInlineDelete`, `allowOpenRecord`

### 3. RecordView (`baserow-app/components/interface/RecordView.tsx`)

The main component that combines Field Panel and Block Canvas:
- Field Panel positioned at top or left
- Block Canvas for flexible layout
- Supports collapsible field panel
- Integrates with InterfaceBuilder for block rendering

**Props:**
- `page`: The page object
- `initialBlocks`: Initial blocks for the canvas
- `recordId`: Current record ID
- `config`: Record view configuration (table, fields, blocks)
- `allFields`: All available fields
- `fieldPanelPosition`: "top" | "left"
- `fieldPanelCollapsible`: Whether field panel can be collapsed

### 4. RecordViewFieldSettings (`baserow-app/components/interface/settings/RecordViewFieldSettings.tsx`)

Settings component for configuring:
- Which fields appear in the field panel
- Field order (drag to reorder)
- Field editability (toggle editable/read-only)

## Block Type: `relatedList`

A new block type has been added to the system:

**Registry Entry:**
```typescript
relatedList: {
  type: 'relatedList',
  label: 'Related Records List',
  icon: 'List',
  defaultWidth: 12,
  defaultHeight: 6,
  minWidth: 4,
  minHeight: 4,
  defaultConfig: {
    title: 'Related Records',
    table_id: '',
    related_table_id: '',
    link_field_name: '',
    display_mode: 'compact',
    filters: [],
    permissions: {
      allowInlineCreate: false,
      allowInlineDelete: false,
      allowOpenRecord: true,
    },
  },
}
```

## Configuration Model

Record views are configured via page settings:

```typescript
interface RecordViewConfig {
  table: string // Table ID
  fields: Array<{
    field: string // Field name or ID
    editable: boolean
    order?: number
  }>
  blocks?: PageBlock[] // Optional blocks (can be loaded separately)
}
```

This is stored in `page.config.recordView` or `page.settings.recordView`.

## Usage

### Creating a Record View Page

1. Create a page with `page_type = 'record_view'`
2. Set `base_table` to the table ID
3. Configure `config.recordView` with:
   - `table`: Table ID
   - `fields`: Array of field configurations

### Adding Related Records Lists

1. Add a `relatedList` block to the page
2. Configure the block:
   - Set `table_id` / `related_table_id` to the related table
   - Set `link_field_name` to the field that links back (e.g., "sponsorship_id")
   - Choose `display_mode`: "compact", "table", or "cards"
   - Add filters if needed
   - Configure permissions

### Example Configuration

```json
{
  "page_type": "record_view",
  "base_table": "sponsorships_table_id",
  "config": {
    "recordView": {
      "table": "sponsorships_table_id",
      "fields": [
        { "field": "status", "editable": true, "order": 0 },
        { "field": "assignee", "editable": true, "order": 1 },
        { "field": "budget", "editable": false, "order": 2 }
      ]
    }
  }
}
```

### Example Block Configuration

```json
{
  "type": "relatedList",
  "config": {
    "title": "Perks",
    "related_table_id": "perks_table_id",
    "link_field_name": "sponsorship_id",
    "display_mode": "compact",
    "filters": [],
    "permissions": {
      "allowInlineCreate": false,
      "allowInlineDelete": false,
      "allowOpenRecord": true
    }
  }
}
```

## Integration Points

### PageRenderer

The `PageRenderer` component can be updated to use `RecordView` for `record_view` pages:

```typescript
if (page.page_type === 'record_view') {
  return (
    <RecordView
      page={page}
      initialBlocks={blocks}
      recordId={recordId}
      config={page.config?.recordView}
      allFields={allFields}
    />
  )
}
```

### Settings Integration

The `RecordViewFieldSettings` component can be integrated into the page settings drawer to allow users to configure which fields appear in the field panel.

## Permissions

Permissions apply independently to:
- **Blocks**: Can be view-only or editable
- **Field Panel**: Each field can be editable or read-only
- **Related Records Lists**: Can control create, delete, and open permissions

## Display Modes

### Field Panel
- **Compact**: Table-style layout (field name | value in rows)
- **Standard**: Card-style layout (each field in its own card)

### Related Records List
- **Compact**: Simple list with primary/secondary fields
- **Table**: Grid layout showing multiple fields as columns
- **Cards**: Card layout showing multiple fields per record

## Next Steps

1. **Integration**: Update `PageRenderer` or `InterfacePageClient` to use `RecordView` for `record_view` pages
2. **Settings UI**: Integrate `RecordViewFieldSettings` into the page settings drawer
3. **Block Settings**: Create settings panel for `relatedList` blocks
4. **Navigation**: Ensure clicking related records opens their Record View
5. **Testing**: Test with various field types and relationships

## Files Modified/Created

### Created
- `baserow-app/components/records/RecordFieldPanel.tsx`
- `baserow-app/components/interface/blocks/RelatedRecordsListBlock.tsx`
- `baserow-app/components/interface/RecordView.tsx`
- `baserow-app/components/interface/settings/RecordViewFieldSettings.tsx`

### Modified
- `baserow-app/lib/interface/types.ts` - Added `relatedList` to `BlockType`
- `baserow-app/lib/interface/registry.ts` - Added `relatedList` block definition
- `baserow-app/components/interface/BlockRenderer.tsx` - Added `relatedList` case
- `baserow-app/lib/interface/block-validator.ts` - Added default config for `relatedList`

## Notes

- The Field Panel acts as the "source of truth" for core record data
- Blocks provide flexibility without breaking data integrity
- No duplication between "form view" and "record view" - everything is unified
- Related records lists can be filtered and configured independently
- The system is designed to be extensible - new block types can be added easily
