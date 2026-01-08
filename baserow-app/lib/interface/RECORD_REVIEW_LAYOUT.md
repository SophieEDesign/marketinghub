# Record Review — Two-Column Layout (Airtable-style)

## Core Principle

The page is still a single Canvas. The two columns are a layout choice, not a page type.

## Canvas Layout Model

### Grid Definition

Use a fixed two-column grid at the Canvas level:

```
CanvasGrid {
  columns: 12
}
```

### Default Column Split

- **Left column**: 4–5 cols (list / navigation / context)
- **Right column**: 7–8 cols (record details)

Example:
- Left: `colSpan = 4` (x=0, w=4)
- Right: `colSpan = 8` (x=4, w=8)

This mirrors Airtable almost exactly.

## Column Responsibilities

### ⬅️ Left Column (Context / Navigation)

Typical blocks:
- Record list (filtered to same table / view)
- Status / workflow summary
- Key metadata (owner, status, priority)
- Compact activity or checklist

Rules:
- Narrow
- Scannable
- Low vertical density
- Often sticky (optional enhancement)

### ➡️ Right Column (Main Record Content)

Typical blocks:
- Record title (large)
- Field groups (form-style)
- Notes / long text
- Related records
- Attachments
- Inline tables
- Content previews (like "Content Calendar")

Rules:
- Scrollable
- Form-first
- Full editing experience
- This is where 80% of interaction happens

## Block Placement (Important)

Blocks do not know they're in a "left" or "right" column.

They only know:

```typescript
Block.layout = {
  x,  // Column position (0 for left, 4 for right)
  y,  // Row position
  w,  // Width in columns (4 for left, 8 for right)
  h   // Height in rows
}
```

The Canvas grid enforces the visual structure.

✅ This keeps blocks reusable everywhere  
❌ No `leftColumnBlocks` or special casing

## Record Context Injection

Every block receives:

```typescript
{
  recordId,    // Current record ID (from page.config.record_id)
  tableId,     // Table ID (from page.base_table or block.config.table_id)
  mode: 'view' | 'edit' | 'review'  // Editing mode
}
```

So:
- Field blocks auto-bind to the current record
- List blocks auto-filter to the same table
- Calendar / table blocks can show related data

Exactly like Airtable's right-hand panel.

## Editing Rules (Airtable-like)

| Mode | Layout Editing | Field Editing |
|------|----------------|---------------|
| `view` | ❌ | ❌ |
| `edit` | ✅ | ✅ |
| `review` | ❌ | ✅ / ⚠️ limited |

Review mode = content editing without layout chaos

## Implementation

### Creating a Two-Column Layout

Use the utility function:

```typescript
import { createRecordReviewTwoColumnLayout } from '@/lib/interface/record-review-layout'

const blocks = createRecordReviewTwoColumnLayout({
  primaryTableId: 'table-id',
  mode: 'review'
})
```

This creates:
1. **Left column** (x=0, w=4): Grid block for record list
2. **Right column** (x=4, w=8): Record block for details
3. **Right column** (x=4, w=8, y=8): Form block for editing

### Manual Block Placement

To place blocks manually:

- **Left column**: Set `x = 0`, `w = 4` (or less)
- **Right column**: Set `x = 4`, `w = 8` (or less, but x must be >= 4)

Example:
```typescript
{
  type: 'grid',
  x: 0,   // Left column
  y: 0,
  w: 4,   // Left column width
  h: 12,
  config: { table_id: 'table-id' }
}
```

## What You Should NOT Do

❌ Do not create a "two column page type"  
❌ Do not hardcode left/right logic in the page  
❌ Do not store column layout on the page  
❌ Do not create a separate record renderer  

If it needs to exist → it's a block.

## Validation Checklist

If all of these are true, you've nailed it:

- ✅ Reload → layout persists
- ✅ Switch records → layout stays the same
- ✅ Switch pages → no flicker
- ✅ Add/remove blocks → grid updates cleanly
- ✅ Same blocks can be used on:
  - content pages
  - dashboards
  - record review
- ✅ No page-type conditionals in Canvas

## Files

- **Utility**: `baserow-app/lib/interface/record-review-layout.ts`
- **Canvas**: `baserow-app/components/interface/Canvas.tsx` (12-column grid)
- **Block Renderer**: `baserow-app/components/interface/BlockRenderer.tsx` (receives mode context)
