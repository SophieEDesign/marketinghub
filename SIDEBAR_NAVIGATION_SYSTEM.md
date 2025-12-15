# Dynamic Sidebar Navigation System

## Overview

The Marketing Hub sidebar navigation is a fully dynamic system that loads all navigation items, categories, tables, and views directly from Supabase. Nothing is hardcoded - all names, icons, ordering, and structure come from the database.

## Architecture

### Database Tables

#### `sidebar_categories`
Stores navigation categories that group related items.

```sql
- id: UUID (primary key)
- name: TEXT (category name, e.g., "Dashboards", "Marketing")
- icon: TEXT (lucide-react icon name in kebab-case, e.g., "layout-dashboard")
- position: INTEGER (sort order)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

#### `sidebar_items`
Stores individual navigation items (tables, views, dashboards, custom links).

```sql
- id: UUID (primary key)
- category_id: UUID (nullable, references sidebar_categories)
- item_type: TEXT ('table' | 'view' | 'dashboard' | 'link')
- item_id: TEXT (ID of the referenced item)
- label: TEXT (display name)
- href: TEXT (URL path)
- icon: TEXT (nullable, lucide-react icon name)
- position: INTEGER (sort order)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### Component Structure

```
components/navigation/
├── Sidebar.tsx              # Main server component - loads data
├── SidebarCategory.tsx      # Collapsible category component
├── SidebarItem.tsx          # Individual navigation item
├── TableSection.tsx         # Collapsible table with views
└── SidebarReorder.tsx       # Drag-and-drop reordering (future use)
```

### Library Functions

**`lib/navigation.ts`** - All data fetching and management:

- `getSidebarCategories()` - Load all categories
- `getSidebarItems(categoryId?)` - Load items (optionally filtered by category)
- `getTables()` - Load all tables
- `getViewsForTable(tableId)` - Load views for a specific table
- `getDashboardViews()` - Load all dashboard views (type='page')
- `getTablesWithViews(userId)` - Load tables with permission-filtered views
- `ensureSidebarItemsForTables()` - Auto-create sidebar items for all tables
- `ensureDashboardsCategory()` - Auto-create Dashboards category
- `updateSidebarOrder()` - Update position ordering (server & client)

**`lib/icons.ts`** - Icon utility:

- `getIconComponent(iconName)` - Converts kebab-case icon names to Lucide React components

## How It Works

### 1. Initial Load Flow

```
User visits page
    ↓
Sidebar component loads (server-side)
    ↓
ensureSidebarItemsForTables() - Creates sidebar items for all tables
    ↓
ensureDashboardsCategory() - Creates Dashboards category if missing
    ↓
Load categories, items, tables, views from Supabase
    ↓
Filter views by user permissions (user_roles)
    ↓
Render sidebar with all data
```

### 2. Permission System

The sidebar respects view-level permissions:

- **Public**: Visible to everyone
- **Authenticated**: Visible to logged-in users
- **Owner**: Visible if user is owner OR has required role in `allowed_roles`

Views are filtered using `getUserRoles(userId)` which queries the `user_roles` table.

### 3. Automatic Table Sync

When the sidebar loads, it automatically:
1. Checks all tables in the `tables` table
2. Creates a `sidebar_item` for each table (if it doesn't exist)
3. Updates the label if the table name changed

This ensures tables always appear in the sidebar without manual configuration.

### 4. Dashboards Category

The system automatically:
1. Creates a "Dashboards" category if it doesn't exist
2. Loads all views where `type = 'page'`
3. Filters by permissions
4. Displays them under the Dashboards category
5. Shows a "+ Create Dashboard" button

### 5. Dynamic Icons

Icons are stored as kebab-case strings (e.g., `"layout-dashboard"`, `"database"`) and converted to PascalCase Lucide React components:

- `"layout-dashboard"` → `LayoutDashboard`
- `"database"` → `Database`
- `"file-text"` → `FileText`

The `getIconComponent()` function handles this conversion automatically.

## Usage Examples

### Adding a Custom Category

```sql
INSERT INTO sidebar_categories (name, icon, position)
VALUES ('Marketing', 'megaphone', 0);
```

### Adding a Custom Link

```sql
INSERT INTO sidebar_items (category_id, item_type, item_id, label, href, icon, position)
VALUES (
  (SELECT id FROM sidebar_categories WHERE name = 'Marketing'),
  'link',
  'custom-1',
  'Campaigns',
  '/campaigns',
  'target',
  0
);
```

### Reordering Items

Items are automatically sorted by `position`. To reorder:

```sql
-- Move item to top
UPDATE sidebar_items SET position = 0 WHERE id = 'item-id';

-- Move item to bottom
UPDATE sidebar_items SET position = 999 WHERE id = 'item-id';
```

### Changing an Icon

```sql
-- Change category icon
UPDATE sidebar_categories SET icon = 'bar-chart' WHERE name = 'Analytics';

-- Change item icon
UPDATE sidebar_items SET icon = 'calendar' WHERE id = 'item-id';
```

## Key Features

### ✅ Fully Dynamic
- No hardcoded table names, view names, or categories
- Everything loaded from Supabase
- Automatically syncs with database changes

### ✅ Permission-Based
- Views filtered by `user_roles` and `allowed_roles`
- Users only see what they have access to
- Respects `access_level` (public, authenticated, owner)

### ✅ Auto-Sync
- Tables automatically added to sidebar
- Dashboards category auto-created
- Labels updated when names change

### ✅ Collapsible Sections
- Categories can expand/collapse
- Tables can expand to show views
- State persists during session

### ✅ Drag-and-Drop Ready
- `SidebarReorder` component created for future use
- Position fields support reordering
- Update functions ready for drag-and-drop implementation

### ✅ Responsive Design
- Fixed 260px width
- Scrollable content area
- Clean, minimal Airtable-style design
- Active state highlighting

## Database Migration

Before using the sidebar, run the migration:

```bash
# In Supabase SQL Editor or via migration tool
psql -f supabase/migrations/create_sidebar_tables.sql
```

Or manually execute the SQL in `supabase/migrations/create_sidebar_tables.sql`.

## Component Props

### SidebarItem
```typescript
{
  id: string
  label: string
  href: string
  icon?: string | null
  level?: number (0 = top level, 1 = nested)
  onClick?: () => void
}
```

### SidebarCategory
```typescript
{
  id: string
  name: string
  icon: string
  items: Array<{
    id: string
    label: string
    href: string
    icon: string | null
  }>
  children?: React.ReactNode
}
```

### TableSection
```typescript
{
  tableId: string
  tableName: string
  views: Array<{
    id: string
    name: string
    type: string
  }>
}
```

## Icon Reference

Common Lucide React icons (use kebab-case in database):

- `database` - Database icon
- `layout-dashboard` - Dashboard icon
- `table` - Table/grid icon
- `columns` - Kanban icon
- `calendar` - Calendar icon
- `file-text` - Form/document icon
- `image` - Gallery icon
- `folder` - Folder icon
- `bar-chart` - Chart icon
- `settings` - Settings icon
- `plus` - Add/create icon

See [Lucide Icons](https://lucide.dev/icons/) for full list.

## Troubleshooting

### Tables Not Appearing
- Check that `ensureSidebarItemsForTables()` is running
- Verify tables exist in the `tables` table
- Check RLS policies allow reading `sidebar_items`

### Views Not Showing Under Tables
- Verify views have `table_id` matching the table
- Check view permissions - user may not have access
- Ensure views are not filtered out (type='page' views go to Dashboards)

### Icons Not Rendering
- Verify icon name is in kebab-case
- Check that icon exists in Lucide React
- Use `getIconComponent()` to test conversion

### Permissions Not Working
- Verify `user_roles` table exists and has data
- Check `getUserRoles()` function is working
- Verify view `allowed_roles` array is set correctly

## Future Enhancements

- [ ] Drag-and-drop reordering UI
- [ ] Hide/show items per user
- [ ] Custom sidebar themes
- [ ] Nested categories
- [ ] Search/filter sidebar items
- [ ] Keyboard navigation shortcuts
