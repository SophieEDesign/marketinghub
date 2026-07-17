# Page Type System - Implementation Summary

## Overview

A dynamic, database-driven Page Type system for Interfaces that allows users to create pages with pre-configured block layouts. All templates are stored in the database and can be modified without code changes.

## Database Schema

### New Tables

**`page_type_templates`**
- `id` (UUID, primary key)
- `type` (TEXT, unique) - Template identifier (e.g., 'list', 'dashboard')
- `label` (TEXT) - Display name
- `description` (TEXT) - User-facing description
- `icon` (TEXT) - Emoji or icon identifier
- `category` (TEXT) - Category grouping ('browse_plan', 'create_review', 'insights', 'advanced', 'other')
- `admin_only` (BOOLEAN) - Whether only admins can use this template
- `default_blocks` (JSONB) - Array of block definitions to seed
- `allowed_blocks` (JSONB) - Array of allowed block types (empty = all allowed)
- `order_index` (INTEGER) - Display order within category
- `created_at`, `updated_at` (TIMESTAMPTZ)

### Modified Tables

**`views`**
- Added `page_type` (TEXT) column - References `page_type_templates.type`

## Page Types

### Browse & Plan
- **list** - Simple grid view
- **gallery** - Visual card-based view
- **kanban** - Board view with drag-and-drop
- **calendar** - Month/week calendar view
- **timeline** - Chronological timeline view

### Create & Review
- **form** - Data collection form
- **record_review** - Review and approve records

### Insights
- **dashboard** - Overview with KPIs, charts, and grid
- **overview** - High-level summary

### Advanced (Admin Only)
- **team** - Collaborative workspace
- **custom** - Fully customizable

### Other
- **blank** - Empty canvas

## API Endpoints

### `GET /api/page-types`
Returns all page type templates, filtered by user role (admin-only templates hidden for non-admins).

**Response:**
```json
{
  "templates": [
    {
      "id": "...",
      "type": "list",
      "label": "List",
      "description": "...",
      "icon": "📋",
      "category": "browse_plan",
      "admin_only": false,
      "default_blocks": [...],
      "allowed_blocks": [],
      "order_index": 0
    }
  ]
}
```

## Usage

### Creating a New Interface Page

1. User clicks "New Page" button
2. Modal opens with:
   - Interface name input
   - Primary table selector
   - Page type picker (grouped by category)
   - Icon picker
3. User selects a page type
4. System:
   - Creates view record with `page_type` set
   - Seeds blocks from template's `default_blocks`
   - Replaces placeholder `table_id` values with primary table ID
5. User is redirected to the new interface page

### Template Structure

Each template's `default_blocks` is a JSON array:

```json
[
  {
    "type": "grid",
    "x": 0,
    "y": 0,
    "w": 12,
    "h": 8,
    "config": {
      "title": "Data Grid",
      "table_id": ""  // Will be replaced with primary table ID
    }
  }
]
```

## Files Created

1. **Database Migration**
   - `baserow-app/supabase/migrations/create_page_type_system.sql`
   - Creates `page_type_templates` table
   - Adds `page_type` column to `views`
   - Seeds initial templates

2. **Server-Side Utilities**
   - `baserow-app/lib/interface/pageTypes.ts`
   - `getPageTypeTemplates()` - Fetch templates (server)
   - `getPageTypeTemplate()` - Get single template (server)
   - `groupTemplatesByCategory()` - Group for UI

3. **Client-Side Utilities**
   - `baserow-app/lib/interface/pageTypes.client.ts`
   - `getPageTypeTemplatesClient()` - Fetch templates (client)
   - `seedBlocksFromTemplate()` - Generate blocks from template

4. **API Endpoint**
   - `baserow-app/app/api/page-types/route.ts`
   - GET handler with role-based filtering

5. **UI Component**
   - `baserow-app/components/interface/NewPageModal.tsx` (updated)
   - Grouped page type picker
   - Template-based block seeding

## Migration Instructions

1. Run the migration:
   ```sql
   -- Execute: baserow-app/supabase/migrations/create_page_type_system.sql
   ```

2. Verify templates were seeded:
   ```sql
   SELECT type, label, category FROM page_type_templates ORDER BY category, order_index;
   ```

3. Existing interfaces will have `page_type = NULL` - this is fine, they'll continue to work

## Customization

### Adding a New Page Type

1. Insert into `page_type_templates`:
   ```sql
   INSERT INTO page_type_templates (type, label, description, icon, category, admin_only, order_index, default_blocks)
   VALUES (
     'my_type',
     'My Type',
     'Description here',
     '🎨',
     'other',
     false,
     0,
     '[...]'::jsonb
   );
   ```

2. The new type will automatically appear in the UI

### Modifying Existing Templates

Update the `default_blocks` JSONB column directly in the database. Changes take effect immediately for new pages.

## Benefits

- **No Code Changes Required** - All templates stored in database
- **Role-Based Access** - Admin-only templates hidden from members
- **Fully Editable** - Pages remain editable after creation
- **Extensible** - Easy to add new types via SQL
- **Backward Compatible** - Existing interfaces continue to work

## Future Enhancements

- Admin UI for managing templates
- Template versioning
- Template sharing between workspaces
- Custom block type restrictions per template
- Template preview images

