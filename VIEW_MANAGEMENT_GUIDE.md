# View Management Guide

## How to Change View Titles

### Method 1: From the Sidebar
1. Navigate to any table (e.g., Content, Campaigns)
2. Expand the table to see its views
3. Click the **three dots (⋮)** menu next to any view
4. Select **"Rename"**
5. Type the new name and press Enter or click the checkmark

### Method 2: From the View Header
1. While viewing any table view
2. Click on the **view name** in the top-left (next to the view type icon)
3. Or **double-click** the view name
4. Type the new name and press Enter

## Per-View Settings (Like Airtable)

Each view saves its own independent settings. You can have multiple grid views with different filters, sorts, column orders, etc.

### What Gets Saved Per View:

1. **Filters** - Each view can have different filter rules
   - Click the **Filter** button in the view header
   - Add multiple filter conditions
   - Filters are automatically saved when you apply them

2. **Sorts** - Each view can have different sort orders
   - Click the **Sort** button in the view header
   - Add multiple sort levels
   - Sorts are automatically saved when you apply them

3. **Column Order** - Drag columns to reorder them
   - Drag column headers to rearrange
   - Order is saved automatically per view

4. **Column Widths** - Resize columns
   - Drag the right edge of column headers
   - Widths are saved automatically per view

5. **Hidden Columns** - Show/hide columns
   - Click the **Settings** button (gear icon) in the view header
   - Toggle column visibility
   - Hidden columns are saved per view

6. **Groupings** - Group rows by field values
   - Click the **Settings** button
   - Create field groups
   - Groups are saved per view

7. **Row Height** - Compact, Medium, or Tall
   - Click the **Settings** button
   - Choose row height
   - Saved per view

### Creating Multiple Views with Different Filters

**Example: Create a "Published Content" view**
1. Click **"New view"** in the sidebar (under the table name)
2. Name it "Published Content"
3. Click the **Filter** button
4. Add filter: `Status` equals `Published`
5. The filter is automatically saved to this view

**Example: Create a "This Month" view**
1. Click **"New view"**
2. Name it "This Month"
3. Click **Filter**
4. Add filter: `Publish Date` is in the last 30 days
5. Click **Sort**
6. Sort by `Publish Date` descending
7. Both filter and sort are saved to this view

**Example: Create a "My Tasks" view**
1. Click **"New view"**
2. Name it "My Tasks"
3. Click **Filter**
4. Add filter: `Assigned To` equals `[Your Name]`
5. Click **Sort**
6. Sort by `Due Date` ascending
7. Click **Settings**
8. Hide columns you don't need
9. All settings are saved to this view

### View Settings Drawer

Click the **Settings** button (gear icon) in the view header to access:
- **Visible Fields** - Show/hide columns
- **Field Order** - Drag to reorder columns
- **Column Widths** - Adjust column sizes
- **Row Height** - Compact, Medium, or Tall
- **Groupings** - Group rows by field values
- **Kanban Group Field** - For Kanban views
- **Calendar Date Field** - For Calendar views
- **Timeline Date Field** - For Timeline views
- **Card Fields** - For Cards views

All changes are automatically saved to the current view.

### View Menu Options

Click the view name dropdown to access:
- **Rename** - Change the view name
- **Duplicate** - Create a copy with all settings
- **Delete** - Remove the view (if not the last one)
- **Set as default** - Make this the default view for the table
- **Change view type** - Switch between Grid, Kanban, Calendar, Timeline, Cards
- **Reset layout** - Clear column order, widths, and hidden columns
- **New view** - Create a new view

## Technical Details

All view settings are stored in the `table_view_configs` table in Supabase:
- `filters` - Array of filter objects
- `sort` - Array of sort objects
- `column_order` - Array of field IDs in display order
- `column_widths` - Object mapping field IDs to pixel widths
- `hidden_columns` - Array of hidden field IDs
- `groupings` - Array of group definitions
- `row_height` - "compact" | "medium" | "tall"
- `view_type` - "grid" | "kanban" | "calendar" | "timeline" | "cards"

Each view has its own row in the database, so settings are completely independent.

