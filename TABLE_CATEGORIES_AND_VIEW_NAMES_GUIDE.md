# Table Categories & View Names Guide

## Table Categories

### What are Table Categories?

Table categories organize tables into groups in the sidebar. Currently, tables are grouped into:
- **Content** - content, ideas, media
- **Planning** - campaigns, tasks
- **CRM** - contacts

### How to Edit Table Categories

Table categories are defined in `lib/tables.ts`. To modify them:

1. **Open** `lib/tables.ts`
2. **Edit** the `tableCategories` array:

```typescript
export const tableCategories: TableCategory[] = [
  {
    id: "content",
    name: "CONTENT",  // This is the sidebar group title
    tableIds: ["content", "ideas", "media"],  // Tables in this category
  },
  {
    id: "planning",
    name: "PLANNING",
    tableIds: ["campaigns", "tasks"],
  },
  {
    id: "crm",
    name: "CRM",
    tableIds: ["contacts"],
  },
];
```

3. **To add a new category:**
```typescript
{
  id: "marketing",
  name: "MARKETING",
  tableIds: ["campaigns", "content"],
}
```

4. **To move a table to a different category:**
   - Remove the table ID from one category's `tableIds` array
   - Add it to another category's `tableIds` array

5. **To rename a category:**
   - Change the `name` property (this is what appears in the sidebar)

### Editing Category Names in the Sidebar (UI)

You can also edit category names directly in the sidebar:

1. **Enable Edit Mode:**
   - Click the **"Edit Sidebar"** button at the bottom of the sidebar
   - Or look for an edit icon/toggle

2. **Rename a Category:**
   - Click the **edit icon** next to the category title (e.g., "CONTENT", "PLANNING")
   - Type the new name
   - Press **Enter** or click outside to save
   - The change is saved to `localStorage` and persists across sessions

**Note:** Sidebar category name edits are stored locally in your browser. To make permanent changes visible to all users, edit `lib/tables.ts` as shown above.

---

## How to Edit View Names

There are **three ways** to rename views:

### Method 1: From the Sidebar (Easiest)

1. **Navigate** to any table (e.g., Content, Campaigns)
2. **Expand** the table to see its views
3. **Click the three dots (⋮)** menu next to the view name
4. **Select "Rename"**
5. **Type** the new name
6. **Press Enter** or click the checkmark (✓) to save
7. **Press Escape** or click the X to cancel

### Method 2: From the View Header (While Viewing)

1. **Open** any view (Grid, Kanban, Calendar, etc.)
2. **Click** on the view name in the top-left (next to the view type icon)
3. **Or double-click** the view name
4. **Type** the new name
5. **Press Enter** to save
6. **Press Escape** to cancel

### Method 3: From the View Menu Dropdown

1. **Open** any view
2. **Click** the view name dropdown (top-left)
3. **Select "Rename"** from the menu
4. **Type** the new name
5. **Press Enter** to save

---

## Technical Details

### Table Categories

- **Location:** `lib/tables.ts`
- **Storage:** Hardcoded in the codebase
- **Sidebar Customizations:** Stored in `localStorage` as `sidebarCustomizations`
- **Format:**
  ```typescript
  {
    groupTitles: {
      "CONTENT": "My Custom Content",
      "PLANNING": "Project Planning"
    },
    itemLabels: {
      "/content/grid": "All Content"
    }
  }
  ```

### View Names

- **Storage:** Database table `table_view_configs`
- **Field:** `view_name`
- **API:** `/api/views/[id]` (PUT request)
- **Hook:** `useViewConfigs` - `updateView(viewId, { view_name: newName })`

### Permissions

- **View Renaming:** Requires `canModifyViews` permission
- **Category Editing:** No special permissions (localStorage only)
- **Table Category Changes:** Requires code changes (not user-editable via UI)

---

## Examples

### Example 1: Rename "Grid" view to "All Items"

1. Go to any table
2. Expand the table in sidebar
3. Click ⋮ next to "Grid"
4. Click "Rename"
5. Type "All Items"
6. Press Enter

### Example 2: Add a new table category

1. Open `lib/tables.ts`
2. Add to `tableCategories`:
```typescript
{
  id: "analytics",
  name: "ANALYTICS",
  tableIds: ["reports", "metrics"],
}
```

### Example 3: Move "campaigns" from Planning to Content

1. Open `lib/tables.ts`
2. Remove `"campaigns"` from Planning's `tableIds`
3. Add `"campaigns"` to Content's `tableIds`

---

## Troubleshooting

### View name won't save
- Check browser console for errors
- Verify you have `canModifyViews` permission
- Ensure the view name is not empty
- Check network tab for API errors

### Category name changes don't persist
- Sidebar category edits are stored in `localStorage`
- They only apply to your browser
- To make permanent changes, edit `lib/tables.ts`

### Can't see "Rename" option
- Ensure you have view modification permissions
- Check that the view menu is expanded
- Try refreshing the page

