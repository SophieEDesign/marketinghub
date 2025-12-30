# Interface Pages Refactor - Airtable-Style System

## Overview

This refactor transforms the Marketing Hub interface system from a template-based approach to a view-based, config-driven system that matches Airtable's Interfaces UX.

## Core Principles

1. **Pages reference SQL views, not templates**
2. **Page types are visualizations only** - they define HOW data is displayed, not WHAT data
3. **All behavior is config-driven** - no hardcoding
4. **SQL views are first-class citizens** - they contain data and business logic

## Database Schema

### New Table: `interface_pages`

```sql
CREATE TABLE interface_pages (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  page_type TEXT NOT NULL, -- enum: list, gallery, kanban, calendar, timeline, form, dashboard, overview, record_review, blank
  source_view TEXT,         -- SQL view name (for most page types)
  base_table TEXT,         -- Only for form page type
  config JSONB DEFAULT '{}',
  group_id UUID REFERENCES interface_groups(id),
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  is_admin_only BOOLEAN DEFAULT FALSE
);
```

## Page Type Definitions

### List
- **Requires**: `source_view`
- **Supports**: Grid toggle
- **Allows**: Inline editing
- **Config**: `visible_columns`, `default_filters`, `default_sorts`

### Gallery
- **Requires**: `source_view`
- **Supports**: Grid toggle
- **Config**: `cover_field`, `title_field`, `card_fields`

### Kanban
- **Requires**: `source_view`
- **Supports**: Grid toggle
- **Config**: `group_by`, `card_fields`

### Calendar
- **Requires**: `source_view`
- **Supports**: Grid toggle
- **Config**: `start_date_field`, `end_date_field`

### Timeline
- **Requires**: `source_view`
- **Supports**: Grid toggle
- **Config**: `group_by_field`, `start_date_field`, `end_date_field`

### Form
- **Requires**: `base_table` (NOT `source_view`)
- **Config**: `form_fields`, `submit_action`

### Dashboard
- **Requires**: `source_view` (aggregation views)
- **Supports**: No grid toggle
- **Config**: `aggregation_views`

### Overview
- **Requires**: Nothing (data optional)
- **Supports**: No grid toggle
- **Config**: Navigation, links, embeds

### Record Review
- **Requires**: `source_view`
- **Supports**: Grid toggle
- **Config**: `record_panel`, `allow_editing`, `detail_fields`

### Blank
- **Requires**: Nothing
- **Supports**: No grid toggle
- **Config**: Clean canvas

## Implementation Status

### ✅ Completed

1. **Database Migration** (`create_interface_pages_system.sql`)
   - Created `interface_pages` table
   - Added RLS policies
   - Migration from old `views` table

2. **Type Definitions** (`lib/interface/page-types.ts`)
   - Page type enum
   - Page type definitions with validation
   - Validation functions

3. **Config System** (`lib/interface/page-config.ts`)
   - PageConfig interface
   - Default configs for each page type

4. **Library Functions** (`lib/interface/pages.ts`)
   - `getInterfacePage()` - Load single page
   - `getAllInterfacePages()` - Load all pages
   - `createInterfacePage()` - Create new page
   - `updateInterfacePage()` - Update page
   - `querySqlView()` - Query SQL views

5. **Page Renderer** (`components/interface/PageRenderer.tsx`)
   - Renders pages based on `page_type` and `config`
   - Supports grid toggle
   - No hardcoding

6. **API Routes**
   - `GET /api/interface-pages/[pageId]` - Load page
   - `POST /api/interface-pages` - Create page
   - `POST /api/sql-views/[viewName]` - Query SQL view

7. **Record Review Component** (`components/interface/RecordReviewView.tsx`)
   - Record switching with detail panel
   - Configurable editing

### 🔄 In Progress

1. **NewPageModal** - Needs update to use `interface_pages` table
2. **PagesTab** - Needs update to load from `interface_pages`
3. **Sidebar** - Needs update to load from `interface_pages`

### ⏳ Pending

1. **SQL View Creation** - Helper functions/UI for creating SQL views
2. **Grid Toggle Implementation** - Full implementation in PageRenderer
3. **Gallery View Component** - Full implementation
4. **Timeline View Component** - Full implementation
5. **Dashboard View Component** - Full implementation with aggregation
6. **Form View Integration** - Update to use `base_table` instead of `source_view`
7. **Migration Script** - Migrate existing interface pages from `views` table

## Usage Examples

### Creating a List Page

```typescript
const page = await createInterfacePage(
  'Content List',
  'list',
  'view_content_working', // SQL view name
  null,
  {
    visualisation: 'list',
    allow_grid_toggle: true,
    visible_columns: ['title', 'status', 'created_at'],
    default_filters: { archived: false },
  }
)
```

### Creating a Form Page

```typescript
const page = await createInterfacePage(
  'Create Content',
  'form',
  null, // No source_view for forms
  'content', // base_table name
  {
    visualisation: 'form',
    form_fields: ['title', 'description', 'status'],
    submit_action: 'create',
  }
)
```

### Querying a SQL View

```typescript
const data = await querySqlView('view_content_working', {
  archived: false,
  status: 'published',
})
```

## Next Steps

1. Update `NewPageModal` to create pages in `interface_pages` table
2. Update `PagesTab` to load from `interface_pages`
3. Update sidebar to load from `interface_pages`
4. Create SQL view helper functions
5. Complete view component implementations
6. Test migration from old system

## Migration Notes

The migration script attempts to migrate existing `views` with `type='interface'` to the new `interface_pages` table. However, `source_view` will need to be set manually or via a separate migration script that creates SQL views from existing view configurations.

