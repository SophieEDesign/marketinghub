# Record Review Page - Page-Owned Left Panel Settings

## Correct Ownership Model

The left column fields are **page-owned**, not block-owned.

### Page Owns:
- `tableId` - Which table provides records
- `leftPanel.visibleFieldIds` - Which fields show in left column
- `leftPanel.fieldOrder` - Order of fields
- `leftPanel.showLabels` - Display option
- `leftPanel.compact` - Display option

### Blocks Consume:
- Blocks receive `recordId` and `tableId` as context
- Blocks do NOT decide field visibility
- Blocks do NOT control left column

## Data Model

### InterfacePage (Database)
```typescript
InterfacePage {
  id: string
  page_type: 'record_review'
  base_table: string | null  // Table ID
  config: {
    tableId?: string
    leftPanel?: {
      visibleFieldIds: string[]
      fieldOrder: string[]
      showLabels: boolean
      compact: boolean
    }
  }
}
```

### Page (Component Type)
```typescript
Page {
  id: string
  settings: {
    tableId: string
    leftPanel: {
      visibleFieldIds: string[]
      fieldOrder: string[]
      showLabels: boolean
      compact: boolean
    }
  }
}
```

**Note:** InterfacePage uses `config`, Page type uses `settings`. We map between them.

## UX Flow: Setting Fields

### 1. Edit Mode → Page Settings (Not Canvas)

When editing a Record Review page:
- Click "Settings" button (page settings, not block settings)
- Shows "Left Panel Fields" section
- Lists all fields from the table
- Allows:
  - Toggle visibility (checkbox)
  - Drag to reorder
  - Display options (show labels, compact mode)

**This is NOT a block editor.**
**This is page-level configuration.**

Airtable equivalent: "Which fields show in the record panel"

### 2. Left Column Renders from Page Settings

Rendering logic is simple:

```typescript
const fields = page.settings.leftPanel.visibleFieldIds
const fieldOrder = page.settings.leftPanel.fieldOrder

// Get ordered fields
const orderedFields = fieldOrder.length > 0
  ? fieldOrder.map(id => fields.find(f => f.id === id))
  : fields

// Render
orderedFields.map(fieldId => (
  <RecordField
    key={fieldId}
    fieldId={fieldId}
    recordId={recordId}
  />
))
```

**No layout persistence.**
**No blocks.**
**No canvas logic.**

## What the Left Column is NOT

This is important because it explains bugs:

❌ **Not a canvas** - It's structural UI  
❌ **Not draggable** - Fixed position  
❌ **Not stored in blocks** - Stored in page.config  
❌ **Not affected by edit/view mode switching** - Always present  
❌ **Not cleared on page change** - Persists across navigation  

It is **structural UI**, like a sidebar.

If blocks are changing when you toggle public/edit → you're treating this as content. That's the root problem.

## Relationship to Right Canvas

| Left Column | Right Canvas |
|-------------|--------------|
| Page-owned | Block-owned |
| Fixed width | Free layout |
| Field list | Any blocks |
| Changes recordId | Reacts to recordId |
| Never saved as blocks | Always saved as blocks |

**They must never share persistence logic.**

## Sanity Checks

Use these to verify correctness:

1. **Can I delete all blocks and still see fields on the left?**
   → **Yes = correct** ✅
   → No = left column is using blocks (wrong)

2. **Can I change field visibility without touching blocks?**
   → **Yes = correct** ✅
   → No = field visibility is in blocks (wrong)

3. **Does switching record re-render blocks without resetting layout?**
   → **Yes = correct** ✅
   → No = recordId is triggering block reloads (wrong)

4. **Does edit/view mode toggle affect left column?**
   → **No = correct** ✅
   → Yes = left column is treated as content (wrong)

If any answer is wrong, the page is still doing too much.

## Implementation Files

1. **`RecordReviewLeftColumn.tsx`** - Renders from `page.settings.leftPanel`
2. **`RecordReviewLeftPanelSettings.tsx`** - Page settings UI for configuring fields
3. **`InterfacePageSettingsDrawer.tsx`** - Includes left panel settings section for record_review pages
4. **`RecordReviewPage.tsx`** - Maps InterfacePage.config to Page.settings

## Key Implementation Details

### Loading Settings
```typescript
// In RecordReviewPage.tsx
const pageConfig = (page as any).config || page.settings || {}
const leftPanelSettings = pageConfig.leftPanel || page.settings?.leftPanel

// Pass to left column
<RecordReviewLeftColumn
  tableId={pageTableId}
  leftPanelSettings={leftPanelSettings}
/>
```

### Saving Settings
```typescript
// In InterfacePageSettingsDrawer.tsx
updates.config = {
  ...currentConfig,
  tableId: baseTable,
  leftPanel: leftPanelSettings, // Page-owned, not block-owned
}
```

### Rendering Fields
```typescript
// In RecordReviewLeftColumn.tsx
const visibleFieldIds = leftPanelSettings?.visibleFieldIds || []
const fieldOrder = leftPanelSettings?.fieldOrder || []

// Get ordered fields
const orderedFields = useMemo(() => {
  if (fieldOrder.length > 0) {
    return fieldOrder.map(id => fields.find(f => f.id === id))
  }
  return fields
}, [fields, fieldOrder])
```

## Architecture Principles

1. **Left column is page-owned** - Settings in `page.config.leftPanel`
2. **Right canvas is block-owned** - Layout in `view_blocks` table
3. **Never mix persistence** - Left column never uses blocks
4. **Structural UI** - Always present, not affected by edit/view mode
5. **Single source of truth** - `page.config.leftPanel` is authoritative
