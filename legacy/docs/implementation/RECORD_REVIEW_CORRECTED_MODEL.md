# Record Review Page - Corrected Model

## High-Level Intent

A Record Review page is a specialized canvas with:
- A **fixed left column** (record selector + field list) - structural UI, NOT a block
- A **free-layout right canvas** (blocks driven by the selected record)

This is not a normal content page, but it still obeys the "blocks only" rule for the right side.

## Layout Structure (Non-negotiable)

```
┌──────────────────────────┬──────────────────────────────────────┐
│ FIXED LEFT COLUMN         │ RIGHT CANVAS                          │
│                           │                                      │
│ Record list / table       │ Free canvas                           │
│ Search / filter           │ (blocks render here)                 │
│ Field visibility settings │                                      │
│                           │                                      │
└──────────────────────────┴──────────────────────────────────────┘
```

### Key Rules

- **Left column is structural** (not draggable, not a block)
- **Right side is a normal canvas** (blocks only)
- **Only the right side persists layout**
- **Left column is always present**, regardless of edit/view mode

## What Lives in the Left Column (Fixed)

This is not configurable per page layout, only per page settings.

**Left column responsibilities:**
- Record selector
- Table-based list
- Search
- Filter
- Sort
- Field visibility (which fields are shown in the record context)
- Active record state (selecting a row sets recordId)

👉 This is effectively: **"Choose a record → everything on the right reacts"**

## Right Side: Canvas (Blocks Only)

The right side behaves exactly like a normal canvas except:

**Every block receives:**
```typescript
context = {
  recordId,  // Ephemeral UI state - never saved to blocks
  tableId    // From page.settings.tableId
}
```

- Blocks may require a record
- Blocks may optionally support record context
- If recordId is missing: "This block requires a record"

**Example blocks on the right:**
- Record fields block
- Notes block
- Related records block
- Activity / comments
- Calendar filtered to this record
- Charts scoped to this record

## Data Model (Clean + Minimal)

### Page
```typescript
Page {
  id
  title
  type: 'content' | 'record_review'
  settings: {
    tableId: string          // Required for record_review
    visibleFieldIds: string[] // Optional - which fields to show
  }
}
```

### Block
```typescript
Block {
  id
  page_id
  type
  config
  layout  // Only right side blocks have layout
}
```

⚠️ **Important:**
- Record selection is **NOT stored in blocks**
- It is **ephemeral UI state**

## State Flow (Critical)

```
User selects record
  → recordId stored in page-level UI state
  → Canvas re-renders (NOT reloads)
  → Blocks receive recordId via props
  → No block state is mutated
```

### ❌ Do NOT:
- Save recordId to blocks
- Reload blocks on record change
- Replace layout on record change
- Use recordId in block keys (causes remounts)

### ✅ Do:
- Pass recordId as prop to blocks
- Let blocks re-render with new context
- Use stable keys based on page.id only

## Edit vs View Behaviour

### Edit Mode
- Can rearrange right canvas
- Can add / configure blocks
- Can configure left-column field visibility
- Left column still present

### View Mode (public / done editing)
- Left column still present
- Right canvas locked
- Zero `setBlocks` calls
- Blocks receive recordId but can't edit

## Validation Checklist

Use this to verify the implementation:

- ✅ Selecting a record does **not** trigger block reload
- ✅ Switching records does **not** affect layout
- ✅ Refresh keeps layout
- ✅ Public view = identical layout
- ✅ No "CLEARING blocks" logs
- ✅ Blocks only re-render, never re-initialise
- ✅ recordId is never saved to block config
- ✅ Left column is always visible (edit and view mode)

If any of those fail → something is still mutating block state incorrectly.

## Mental Shortcut

- **Content page** = blank canvas
- **Dashboard** = content page with starter blocks
- **Record review** = canvas + fixed record rail

**Same engine. Different shell.**

## Implementation Files

1. **`RecordReviewLeftColumn.tsx`** - Fixed left column component (structural UI)
2. **`RecordReviewPage.tsx`** - Wrapper that combines left column + right canvas
3. **`InterfacePageClient.tsx`** - Routes `record_review` pages to `RecordReviewPage`
4. **`page-types.ts`** - Defines `record_review` page type

## Key Implementation Details

### Record Selection
```typescript
// In RecordReviewPage.tsx
const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)

// Passed to InterfaceBuilder as prop (never saved)
<InterfaceBuilder
  key={`record-review-canvas-${page.id}`}  // Stable key - NOT based on recordId
  recordId={selectedRecordId}  // Ephemeral - just for context
/>
```

### Block Context
```typescript
// Blocks receive recordId via BlockRenderer
<BlockRenderer
  recordId={recordId}  // From page-level UI state
  mode={mode}
  pageTableId={pageTableId}
/>
```

### No Block Reloads
- Canvas useEffect only depends on `blocks`, `isEditing`, `layout.length`
- Does NOT depend on `recordId`
- InterfaceBuilder only updates blocks when hash changes (from API)
- Does NOT update when `recordId` changes

## Architecture Principles

1. **Left column is structural** - Not a block, always present
2. **Right side is canvas** - Normal block-based layout
3. **recordId is ephemeral** - UI state only, never persisted
4. **No block reloads** - Blocks re-render with new context
5. **Layout persists** - Only right side blocks have saved layout
