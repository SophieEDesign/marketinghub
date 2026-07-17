# Page Anchors Implementation

## Overview

This implementation eliminates invalid page states by requiring every page to have exactly one "anchor" that defines what the page is anchored to. This ensures every page can be edited and prevents dead-end states.

## Changes Made

### 1. Database Migration (`add_page_anchors.sql`)

- Added anchor columns to `interface_pages`:
  - `saved_view_id` - For list/gallery/kanban/calendar/timeline/record_review pages
  - `dashboard_layout_id` - For dashboard/overview pages (references view_blocks.view_id)
  - `form_config_id` - For form pages
  - `record_config_id` - For record_review pages
- Added CHECK constraint trigger to ensure exactly one anchor exists
- Removed `blank` from page_type enum
- Migrated existing blank pages to `overview` type

### 2. Type System Updates

**`lib/interface/page-types.ts`:**
- Removed `blank` from `PageType`
- Added `getRequiredAnchorType()` function
- Added `validatePageAnchor()` function

**`lib/interface/pages.ts`:**
- Updated `InterfacePage` interface with anchor fields
- Added `getPageAnchor()` and `hasPageAnchor()` helper functions
- Updated `createInterfacePage()` to require anchor parameter

### 3. Page Creation Flow

**`components/interface/PageCreationWizard.tsx` (NEW):**
- Multi-step wizard that forces anchor selection
- Step 1: Choose page purpose (view/dashboard/form/record)
- Step 2: Configure anchor (select view/table or confirm dashboard)
- Step 3: Name the page
- Cannot proceed without completing each step

**`components/settings/PagesTab.tsx`:**
- Replaced simple "name-only" creation with `PageCreationWizard`
- Old creation flow hidden but kept for backward compatibility

### 4. Edit Page Behavior

**`components/interface/InterfacePageClient.tsx`:**
- Removed alert-based blocking
- `handleEditClick()` now opens appropriate editor based on anchor type:
  - `saved_view` → Navigate to view settings
  - `dashboard` → Open InterfaceBuilder
  - `form` → Open form builder (to be implemented)
  - `record` → Open record config panel (to be implemented)
- If page has no anchor, redirects to setup

### 5. Setup States

**`components/interface/PageSetupState.tsx` (NEW):**
- Shows setup prompt for pages without anchors
- Contextual guidance based on required anchor type
- Action button to configure page
- Different message for non-admin users

**`components/interface/PageRenderer.tsx`:**
- Removed `BlankView` component
- Added `InvalidPageState` component for pages without configuration

## Anchor Types

### `saved_view_id`
- **Page Types:** list, gallery, kanban, calendar, timeline, record_review
- **References:** `views.id`
- **Edit Opens:** View settings panel (filters, grouping, sorting)

### `dashboard_layout_id`
- **Page Types:** dashboard, overview
- **References:** `view_blocks.view_id` (self-reference, blocks stored with view_id = page.id)
- **Edit Opens:** InterfaceBuilder (block editor)

### `form_config_id`
- **Page Types:** form
- **References:** `tables.id` (stored as UUID string)
- **Edit Opens:** Form builder (to be implemented)

### `record_config_id`
- **Page Types:** record_review
- **References:** Configuration stored in `config` JSONB
- **Edit Opens:** Record config panel (to be implemented)

## Validation Rules

1. **Every page must have exactly one anchor** (enforced by database trigger)
2. **Anchor type must match page type** (enforced by application logic)
3. **Pages cannot be created without anchor** (enforced by creation wizard)
4. **Pages without anchors show setup state** (not blank/dead-end)

## Migration Notes

- Existing pages without anchors will show setup state
- Blank pages migrated to `overview` type
- Dashboard pages get `dashboard_layout_id` set to their own `id` if blocks exist
- Pages with `source_view` but no `saved_view_id` need manual migration

## Next Steps (To Be Implemented)

1. **View Settings Panel** - For pages with `saved_view_id` anchor
2. **Form Builder** - For pages with `form_config_id` anchor
3. **Record Config Panel** - For pages with `record_config_id` anchor
4. **Migration Script** - To migrate existing pages with `source_view` to `saved_view_id`

## Testing Checklist

- [ ] Cannot create page without anchor
- [ ] Edit Page always opens editor (no alerts)
- [ ] Pages without anchors show setup state
- [ ] Dashboard pages can be edited
- [ ] List/Gallery/Kanban pages redirect to view settings
- [ ] Blank page type removed from all dropdowns
- [ ] Database constraint prevents invalid anchor combinations

