# Sidebar Navigation Refactor

## Overview

Refactored the Interfaces sidebar to behave like a navigation menu by default, with editing controls only visible in explicit "Edit mode". This creates a cleaner, more Airtable-like experience.

## Implementation

### 1. Sidebar Mode Context

**File:** `baserow-app/contexts/SidebarModeContext.tsx`

Created a React context to manage sidebar mode state:
- **Modes:** `"view"` (default) | `"edit"`
- **Persistence:** Mode preference saved to localStorage
- **API:** `useSidebarMode()` hook provides `mode`, `setMode()`, and `toggleMode()`

### 2. Mode Toggle Button

**File:** `baserow-app/components/layout/AirtableSidebar.tsx`

Added "Edit interfaces" button in the Interfaces section header:
- Shows "Edit" button when in view mode
- Shows "Done" button (with checkmark) when in edit mode
- Button has visual feedback (blue background when active)
- Only visible when Interfaces section is expanded

### 3. GroupedInterfaces Component Refactor

**File:** `baserow-app/components/layout/GroupedInterfaces.tsx`

Completely refactored to support two modes:

#### Navigation Mode (Default)
- **Groups:** Folder-style UI with chevron expand/collapse and folder icon
- **Interfaces:** Clean menu items with subtle hover states
- **No editing controls:** No drag handles, delete buttons, or inline rename
- **Active state:** Active interface has subtle background highlight using primary color
- **Click behavior:** Clicking navigates (no edit mode toggle)

#### Edit Mode
- **Groups:** Full editing UI with drag handles, rename, delete
- **Interfaces:** Drag handles, inline rename, edit dropdown menu
- **Drag & Drop:** Enabled for reordering groups and interfaces
- **Add buttons:** "New Interface" and "New Group" buttons visible
- **Visual feedback:** Edit mode button highlighted

### 4. Component Structure

**NavigationPage Component:**
- Clean link-based navigation
- Active state styling
- No editing affordances

**SortableGroup Component:**
- Conditional rendering based on mode
- Navigation mode: folder-style button
- Edit mode: full sortable with drag handles

**SortablePage Component:**
- Only rendered in edit mode
- Full drag-and-drop support
- Inline rename capability

### 5. Provider Integration

**File:** `baserow-app/components/layout/WorkspaceShellWrapper.tsx`

Added `SidebarModeProvider` wrapper around `WorkspaceShell` to make sidebar mode available throughout the app.

## Features

### Navigation Mode Features
✅ Clean folder-style groups with chevron expand/collapse  
✅ Menu-style interface items  
✅ Active interface highlighting  
✅ No editing controls visible  
✅ Click to navigate (never toggles edit mode)  
✅ Keyboard navigation support  

### Edit Mode Features
✅ Drag handles for groups and interfaces  
✅ Drag-and-drop reordering  
✅ Inline rename for groups and interfaces  
✅ Delete buttons (groups only)  
✅ "New Interface" and "New Group" buttons  
✅ Visual mode indicator  

### Persistence
✅ Sidebar mode preference saved to localStorage  
✅ Mode persists across page reloads  
✅ Per-user preference (client-side)  

## Visual Design

### Navigation Mode
- **Groups:** Medium weight text, muted gray color, folder icon
- **Interfaces:** Normal weight, indented, subtle hover
- **Active:** Primary color background (10% opacity) and text color
- **No borders or outlines**
- **Clean, minimal appearance**

### Edit Mode
- **Groups:** Uppercase, bold, with drag handle
- **Interfaces:** Full editing controls on hover
- **Buttons:** Visible "New Interface" and "New Group"
- **Visual indicator:** Edit button highlighted

## Interaction Rules

1. **Clicking an interface NEVER toggles edit mode** - only navigates
2. **Dragging is disabled unless in edit mode** - sortable components disabled
3. **Sidebar editing does NOT affect interface layout editing** - separate concerns
4. **Mode persists per user** - localStorage preference

## Accessibility

- Keyboard navigation works in view mode
- Edit mode supports keyboard drag via dnd-kit
- Hover states differ between modes
- Clear visual feedback for active items

## Constraints Met

✅ No hardcoded interface names  
✅ No Airtable-specific text  
✅ Reusable sidebar components  
✅ Works with existing `interface_groups` and `interfaces` tables  
✅ Clean separation of navigation and editing concerns  

## Usage

The sidebar now defaults to navigation mode. Users can:
1. Click "Edit" button to enter edit mode
2. Make changes (reorder, rename, delete)
3. Click "Done" to return to navigation mode
4. Mode preference is remembered for next visit

