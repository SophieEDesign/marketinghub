# Sidebar and Block Settings Refactor

## Summary

Refactored the sidebar and interface navigation to match Airtable's Interfaces UX, and improved the Block Settings panel with better organization and Airtable-like UI patterns.

## Sidebar Changes

### Browse Mode (Default)
- Clean navigation menu - no editing controls
- Groups render as folder-style items with caret toggle
- Pages render indented beneath their group
- Clicking caret only expands/collapses (no navigation)
- Clicking page navigates (never toggles edit mode)
- System groups (like "Ungrouped") are hidden
- Empty groups are hidden

### Edit Mode
- Shows "+ New Page" and "+ Group" buttons
- Enables drag-and-drop reordering
- Allows inline renaming
- Shows delete buttons
- System groups are visible (but can't be deleted)
- All groups shown, including system groups

## Data Changes

### Migration: `ensure_ungrouped_group.sql`
- Creates system "Ungrouped" group if it doesn't exist
- Assigns all interface pages without group_id to "Ungrouped"
- Adds `is_system` flag to `interface_groups` table
- Creates trigger to auto-assign new interface pages to "Ungrouped"

### Group Management
- All pages must belong to a group
- Ungrouped pages go into system "Ungrouped" group
- System groups cannot be deleted
- Deleting a group moves its pages to "Ungrouped"

## Block Settings Panel Changes

### New Tab Structure
- **Basics**: Core settings (table, view type, source)
- **Advanced**: Advanced configuration (filters, sorting, grouping)
- **Appearance**: Visual styling (colors, borders, padding)

### Card-Style View Type Selector
- Replaces button grid with card-style options
- Each card shows icon + description
- Only shows compatible view types based on available fields
- Better visual hierarchy

### Contextual Empty States
- Replaces generic "Loading..." with contextual messages
- Shows helpful hints when no data is available
- Better user guidance

## Files Modified

1. `supabase/migrations/ensure_ungrouped_group.sql` - New migration
2. `baserow-app/components/layout/GroupedInterfaces.tsx` - Refactored Browse/Edit modes
3. `baserow-app/components/interface/SettingsPanel.tsx` - Refactored to Basics/Advanced/Appearance

## Next Steps

- Complete Block Settings panel refactor with card-style view selector
- Add field type checking for compatible view types
- Add contextual empty states throughout
- Test group management and page assignment

