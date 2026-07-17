# Baserow-Style View System Integration

## Overview

A complete Baserow-style view layer has been integrated into the Marketing Hub. This system provides multiple view types (Grid, Kanban, Calendar, Form, Interface Pages) with full CRUD operations, filtering, sorting, and a block-based dashboard system.

## Structure

### Routing (`app/tables/[tableId]/`)
- `page.tsx` - Table overview with list of views
- `views/new/page.tsx` - Create new view modal
- `views/[viewId]/page.tsx` - View renderer (detects type and renders appropriate component)
- `views/[viewId]/edit/page.tsx` - Edit view settings

### View Components (`components/views/`)
- **GridView.tsx** - Spreadsheet-style table with inline editing
- **KanbanView.tsx** - Board view with grouping by field
- **CalendarView.tsx** - Month/week/day calendar with FullCalendar
- **FormView.tsx** - Auto-generated form for creating/editing records
- **RowDetail.tsx** - Detailed view of a single record
- **InterfacePage.tsx** - Block-based dashboard with react-grid-layout
- **ViewToolbar.tsx** - Toolbar with add row, filters, sorts
- **FilterBar.tsx** - Display active filters
- **SortBar.tsx** - Display active sorts
- **FieldSelector.tsx** - Toggle field visibility
- **ViewEditForm.tsx** - Edit view name and duplicate

### Block Components (`components/blocks/`)
- **BlockRenderer.tsx** - Renders blocks in grid layout
- **BlockSettingsDrawer.tsx** - Edit block settings
- **TextBlock.tsx** - Rich text content
- **KpiBlock.tsx** - Key performance indicators
- **ChartBlock.tsx** - Data visualization (placeholder)
- **TableBlock.tsx** - Embed table view
- **HtmlBlock.tsx** - Custom HTML
- **ImageBlock.tsx** - Display images
- **EmbedBlock.tsx** - Embed external content
- **AutomationBlock.tsx** - Automation workflow display

### Data Layer (`lib/`)
- **supabase.ts** - Server and client Supabase clients
- **data.ts** - Row CRUD operations with filtering/sorting
- **views.ts** - View management (create, update, duplicate)
- **blocks.ts** - Block management and layout updates
- **permissions.ts** - Access control checking
- **utils.ts** - Utility functions (cn for className merging)

## Features

### View Types

1. **Grid View**
   - Inline cell editing
   - Filtering and sorting support
   - Pagination
   - Field visibility control

2. **Kanban View**
   - Groups rows by configurable field
   - Card-based display
   - Drag and drop ready (structure in place)

3. **Calendar View**
   - Month/week/day views
   - Click events to open RowDetail
   - Date field configuration

4. **Form View**
   - Auto-generated from visible fields
   - Create and edit modes
   - Validation ready

5. **Interface Page (Gallery)**
   - Block-based dashboard
   - Drag and drop layout editing
   - 8 block types supported

### Data Loading

- Server Components for initial data load
- Client Components for interactivity
- Filters applied at query level
- Sorting applied at query level
- Field visibility from `view_fields` table

### Access Control

- Public, authenticated, owner, role-based
- Checked at page level
- RLS policies in Supabase

## Database Schema

Uses existing Supabase schema:
- `tables` - Core table definitions
- `views` - View configurations
- `view_fields` - Field visibility and order
- `view_filters` - Filter rules
- `view_sorts` - Sorting configuration
- `view_blocks` - Block configurations
- `table_rows` - Row data (JSONB)
- `automations` - Automation workflows

## Usage

### Accessing Views

Navigate to `/tables/[tableId]` to see all views for a table.
Click on a view to open it at `/tables/[tableId]/views/[viewId]`.

### Creating Views

1. Go to `/tables/[tableId]/views/new`
2. Enter view name
3. Select view type
4. View is created and opened

### Editing Views

1. Open a view
2. Click "Edit View" button
3. Modify name or duplicate

### Adding Blocks (Interface Pages)

1. Create a view with type "gallery"
2. Click "Edit Layout"
3. Click "Add Block"
4. Configure block settings

## Integration Points

- Uses existing Supabase authentication
- Integrates with existing Marketing Hub layout
- Uses shadcn/ui components
- Tailwind CSS styling
- Next.js 14 App Router

## Next Steps

- Implement drag and drop for Kanban cards
- Add filter/sort UI modals
- Enhance block settings
- Add field type detection and proper input components
- Implement formula fields
- Add lookup/rollup fields
