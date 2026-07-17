# Unified Canvas + Blocks Architecture - Simple Summary

**Canonical reference for blocks, storage, and rendering paths:** [BLOCK_AND_PAGE_ARCHITECTURE.md](BLOCK_AND_PAGE_ARCHITECTURE.md)

## Core Concept

**Three layers: Data → Pages → Blocks**

```
┌─────────────────────────────────────────┐
│           DATA (Tables/Views)           │
│  - Tables                               │
│  - Views                                │
│  - Records                              │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│          PAGES (2 Types Only)           │
│  - content: Generic canvas              │
│  - record_view: Canvas + recordId       │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│            BLOCKS (Everything)           │
│  - CalendarBlock                        │
│  - TableBlock                           │
│  - KPIBlock                             │
│  - ChartBlock                           │
│  - TextBlock                            │
│  - etc.                                 │
└─────────────────────────────────────────┘
```

## The Three Layers

### 1. Core Data
- **Tables**: Database tables with records
- **Views**: Saved views (filters, sorts, fields)
- **Records**: Individual data rows

**Purpose**: Source of truth for all data

### 2. Pages (2 Types Only)

#### `content`
- Generic canvas page
- No inherent data context
- Just a container for blocks

#### `record_view`
- Canvas page with injected `recordId`
- Blocks can opt-in to record context
- Same as content, but provides record context

**Purpose**: Containers that provide context (pageId, optional recordId)

**Important**: Pages never fetch data directly — blocks decide what data they need.

### 3. Blocks (Everything)

All functionality lives in blocks:

| Feature | Block Type |
|---------|-----------|
| Calendar | `CalendarBlock` |
| Table/Grid/List | `TableBlock` |
| KPIs | `KPIBlock` |
| Charts | `ChartBlock` |
| Text/Content | `TextBlock` |
| Forms | `FormBlock` |
| Filters | `FilterBlock` |

**Purpose**: Define behavior, layout, and data access

## How It Works

### Page Rendering
```
Page (content or record_view)
  ↓
Canvas (universal renderer)
  ↓
Blocks (each handles its own data/config)
```

### Data Flow
```
Block → Reads from Data Layer
Block → Stores config in block.config
Block → Stores layout in block.layout
```

### Persistence
```
Everything → Blocks Table
  - block.config (behavior, filters, data source)
  - block.layout (position, size)
  - block.type (calendar, table, kpi, etc.)
```

## Key Principles

1. **Pages are containers** - They don't render UI, they just provide context
2. **Canvas is universal** - Every page renders Canvas, no exceptions
3. **Blocks are everything** - All functionality, data access, and behavior lives in blocks
4. **Single persistence** - Only blocks table, no page-level UI state

## What Was Removed

❌ **Old Page Types** (10 types → 2 types):
- `calendar`, `dashboard`, `grid`, `list`, `timeline`, `kanban`, `gallery`, `form`, `overview`, `record_review`

❌ **Page-Level Rendering**:
- No more conditional rendering based on page type
- No more view-specific renderers

❌ **Page-Level Persistence**:
- No page-level UI state
- No view-level persistence
- No duplicated config storage

## What Remains

✅ **2 Page Types**: `content` and `record_view`

✅ **Universal Canvas**: All pages render the same way

✅ **Block-Based Everything**: Calendar, tables, KPIs, charts, etc. are all blocks

✅ **Single Persistence Model**: Everything in blocks table

## Example: Calendar Page

**Before** (Old Architecture):
```
Page (type: 'calendar')
  → CalendarView component
  → Page-level config
  → View-level persistence
```

**After** (Unified Architecture):
```
Page (type: 'content')
  → Canvas
    → CalendarBlock
      → block.config (date field, filters, etc.)
      → block.layout (position, size)
```

## Benefits

1. **Simpler**: 2 page types instead of 10+
2. **Predictable**: One render path, one persistence model
3. **Flexible**: Blocks can be mixed and matched
4. **Maintainable**: No page-type-specific code paths
5. **Scalable**: New features = new blocks, not new page types

## Guardrail Principle (Important)

**Never introduce a new page type to add behaviour.**
**If something needs new behaviour, it must be a block.**

### Why this matters:
- Prevents regression into page-type sprawl
- Keeps the architecture honest
- Makes reviews simpler ("should this be a block?" → yes)

This principle will save Future You from Future Meetings™.

## Migration Path

Old pages → New pages:
- `dashboard` → `content` page with pre-populated blocks
- `calendar` → `content` page with `CalendarBlock`
- `list` → `content` page with `TableBlock`
- `record_review` → `record_view` page with blocks

**Important**: Data (tables, views, records) remain unchanged — only UI structure is migrated.
