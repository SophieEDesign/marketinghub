# Sidebar & Page Creation Alignment

## Summary

This document tracks the alignment of the sidebar navigation and page creation/editing UI with the product model.

## ✅ Completed Changes

### 1. Sidebar Rebuild (`components/navigation/Sidebar.tsx`)

**Removed:**
- Legacy navigation systems (`sidebar_categories`, `sidebar_items`)
- Dashboard views from `views` table
- Views displayed in sidebar (internal-only)
- Automations from sidebar
- Uncategorized items from legacy system

**New Structure:**
- **For ALL users:** Interfaces (folders) → Pages (clickable links)
- **For ADMINS only:** Separate "Admin / Data" section with Tables
- Single source of truth: Only `interface_groups` and `interface_pages`

**Key Features:**
- Interfaces are expandable/collapsible folders only (not clickable)
- Pages are the only navigable items (link to `/pages/{pageId}`)
- Empty interfaces show "No pages yet" with "Add Page" link for admins
- Tables don't show views (views are internal-only)

### 2. Page Settings (`baserow-app/components/interface/InterfacePageSettingsDrawer.tsx`)

**Changes:**
- ✅ Removed SQL view selection
- ✅ Replaced with Table selection
- ✅ Changed "Group" to "Interface" in UI
- ✅ Interface is now required (no "__none__" option)
- ✅ Simplified to: Page name, Page type (read-only), Interface (required), Source Table, Admin-only toggle, Delete

**Before:**
- "Source SQL View" dropdown
- "Group" dropdown (optional)

**After:**
- "Source Table" dropdown
- "Interface" dropdown (required)

### 3. Page Creation (`baserow-app/components/interface/PageCreationWizard.tsx`)

**Changes:**
- ✅ Removed view selection step
- ✅ Replaced with Table selection
- ✅ Interface selection is required (first step)
- ✅ Users select Tables, not SQL Views
- ✅ SQL views are created automatically behind the scenes

**Flow:**
1. Select Interface (required)
2. Choose purpose (view, dashboard, form, record)
3. Select Table (for data-backed pages)
4. Name the page

### 4. Settings Pages Tab (`baserow-app/components/settings/PagesTab.tsx`)

**Changes:**
- ✅ Uses `PageCreationWizard` component
- ✅ Terminology updated: "Interface" instead of "Group"
- ✅ Column header says "Interface" not "Group"
- ✅ Shows "Ungrouped Interface" instead of "Ungrouped"

### 5. Settings Interfaces Tab (`baserow-app/components/settings/InterfacesTab.tsx`)

**Changes:**
- ✅ Shows Interfaces (interface_groups) as main items
- ✅ Pages nested underneath each Interface
- ✅ Clear visual hierarchy: Interface → Pages
- ✅ Updated description to clarify Interfaces are containers

## 📋 Terminology Updates

| Old Term | New Term | Status |
|----------|----------|--------|
| Group | Interface | ✅ Updated |
| SQL View selection | Table selection | ✅ Updated |
| "Ungrouped" | "Ungrouped Interface" | ✅ Updated |
| "Category" (in Interface settings) | "Interface" | ✅ Updated |
| "Interface Group" | "Interface" | ✅ Updated |
| "New Group" button | "New Interface" button | ✅ Updated |
| "No group (Uncategorized)" | "Ungrouped Interface" | ✅ Updated |

**Note:** "Group" is still used correctly for data grouping concepts (e.g., "Group By" in table views for grouping records by status/pipeline fields). This is intentional and refers to data organization, not navigation.

## 🎯 Product Model Compliance

### Hierarchy Enforced
```
Tables (admin only) ✅
  ↓
Views (internal plumbing) ✅
  ↓
Pages (user-facing screens) ✅
  ↓
Interfaces (containers for pages) ✅
```

### Sidebar Rules
- ✅ Interfaces shown as expandable folders
- ✅ Pages shown nested under Interfaces
- ✅ Pages link to `/pages/{pageId}`
- ✅ Interfaces NOT clickable (expand/collapse only)
- ✅ Admin-only section for Tables
- ✅ No Views, Automations, or internal entities shown

### Page Creation Rules
- ✅ Interface selection required
- ✅ Table selection (not SQL View)
- ✅ SQL views created automatically
- ✅ No technical language exposed

### Page Settings Rules
- ✅ Minimal, human-readable fields
- ✅ No SQL view selection
- ✅ No internal IDs exposed
- ✅ Interface required

## 🔍 Remaining Work

### Terminology Cleanup
- [ ] Check all components for "Group" → "Interface" terminology
- [ ] Update any remaining user-facing text

### API Updates
- [ ] Ensure API endpoints handle Table → SQL View conversion automatically
- [ ] Update page creation API to auto-generate SQL views from tables

### Documentation
- [ ] Update component documentation
- [ ] Update user-facing help text

## ✅ Acceptance Criteria Status

- ✅ Non-admin users: See only Interfaces + Pages
- ✅ Non-admin users: Cannot see Tables or Automations
- ✅ Admin users: See Interfaces + Pages + Admin/Data section
- ✅ Sidebar never shows Views or internal entities
- ✅ Clicking a Page navigates correctly
- ✅ Clicking an Interface never renders content directly
- ✅ Page creation asks for Tables, not SQL Views
- ✅ "Ungrouped" treated as default Interface
- ✅ Settings handles all configuration

