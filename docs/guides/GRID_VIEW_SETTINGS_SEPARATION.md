# Grid View Settings Separation

## Overview

This document describes the separation of grid view settings from general view configuration. Grid-specific settings are now stored in a dedicated `grid_view_settings` table, keeping them separate from the general `views` table configuration.

## Changes Made

### 1. Database Migration

**File:** `supabase/migrations/create_grid_view_settings.sql`

Created a new `grid_view_settings` table with the following structure:
- `id` (UUID, primary key)
- `view_id` (UUID, foreign key to views, unique)
- `group_by_field` (TEXT, nullable) - Field name to group by
- `column_widths` (JSONB) - Map of field_name -> width in pixels
- `column_order` (JSONB) - Array of field names in display order
- `column_wrap_text` (JSONB) - Map of field_name -> boolean for text wrapping
- `row_height` (TEXT) - 'short', 'medium', or 'tall'
- `frozen_columns` (INTEGER) - Number of frozen columns
- `created_at`, `updated_at` (TIMESTAMPTZ)

The migration also:
- Migrates existing grid settings from `views.config` to the new table
- Sets up RLS policies for access control
- Creates indexes for performance

### 2. Library Functions

**File:** `lib/grid-view-settings.ts`

Created helper functions for managing grid view settings:
- `loadGridViewSettings(viewId)` - Load settings for a view
- `saveGridViewSettings(viewId, settings)` - Create or update settings
- `updateGroupBy(viewId, fieldName)` - Update group by field
- `updateColumnWidths(viewId, widths)` - Update column widths
- `updateColumnOrder(viewId, order)` - Update column order
- `updateColumnWrapText(viewId, wrapText)` - Update text wrap settings
- `updateRowHeight(viewId, height)` - Update row height

### 3. Component Updates

#### GroupDialog (`baserow-app/components/grid/GroupDialog.tsx`)
- Updated to save group by settings to `grid_view_settings` instead of `views.config`
- Creates settings record if it doesn't exist

#### GridViewWrapper (`baserow-app/components/grid/GridViewWrapper.tsx`)
- Updated `handleGroupByChange` to use `grid_view_settings` table
- Creates settings record if it doesn't exist

#### View Page (`baserow-app/app/tables/[tableId]/views/[viewId]/page.tsx`)
- Updated to load grid settings from `grid_view_settings` table
- Falls back to `views.config` for backward compatibility
- Passes grid settings to `AirtableViewPage` component

#### AirtableViewPage (`baserow-app/components/grid/AirtableViewPage.tsx`)
- Updated to accept `initialGroupBy` and `initialGridSettings` props
- Uses grid settings from props instead of `view.config`

## Benefits

1. **Separation of Concerns**: Grid-specific settings are now separate from general view configuration
2. **Better Organization**: Grid settings are easier to find and manage
3. **Type Safety**: Dedicated table structure provides better type safety
4. **Performance**: Indexed lookups for grid settings
5. **Scalability**: Easy to add new grid-specific settings without cluttering `views.config`

## Backward Compatibility

The code maintains backward compatibility by:
- Falling back to `views.config` if grid settings don't exist in the new table
- Migration automatically moves existing settings from `views.config` to `grid_view_settings`

## Future Enhancements

1. Update `AirtableGridView` to save column widths to `grid_view_settings` instead of localStorage
2. Add UI for managing grid view settings (column widths, order, wrap text)
3. Add user-specific grid view settings (per-user column preferences)
4. Add grid view settings to view duplication logic

## Notes

- Views are kept in core data (belong to tables)
- Grid view settings are separate from general view configuration
- Dashboard/interface pages may still use `views` table but with different structure (this is separate from grid view settings)

