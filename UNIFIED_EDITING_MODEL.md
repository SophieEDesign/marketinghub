# Unified Editing Model

## Overview

All editing states across the application are now managed through a single, unified `EditModeContext`. This consolidates previously separate editing models into one consistent system.

## Architecture

### EditModeContext (`baserow-app/contexts/EditModeContext.tsx`)

The unified context manages all editing states with clear scopes:

- **`sidebar`** - Navigation structure editing (groups, pages)
- **`page`** - Page-level editing (page configuration)
- **`block`** - Block editing (dashboard/overview blocks)
- **`record`** - Individual record editing
- **`grid`** - Grid field editing

### Key Features

1. **Single Source of Truth** - All edit states managed in one place
2. **Scope-Based** - Clear separation of editing contexts
3. **Persistence** - Edit mode preferences saved to localStorage
4. **Context Tracking** - Tracks which page/record/table is being edited
5. **Backward Compatible** - SidebarModeContext wraps the unified context

## Usage

### Basic Hook

```typescript
import { useEditMode } from "@/contexts/EditModeContext"

const { isEditing, enterEditMode, exitEditMode, toggleEditMode } = useEditMode()

// Check if sidebar is being edited
if (isEditing("sidebar")) {
  // Show editing UI
}

// Enter block editing mode
enterEditMode("block", { pageId: "123" })

// Exit all edit modes
exitAllEditModes()
```

### Convenience Hooks

#### Sidebar Editing

```typescript
import { useSidebarEditMode } from "@/contexts/EditModeContext"

const { isEditing, toggle, enter, exit } = useSidebarEditMode()
```

#### Page Editing

```typescript
import { usePageEditMode } from "@/contexts/EditModeContext"

const { isEditing, toggle, enter, exit, editingPageId } = usePageEditMode(pageId)
```

#### Block Editing

```typescript
import { useBlockEditMode } from "@/contexts/EditModeContext"

const { isEditing, toggle, enter, exit } = useBlockEditMode(pageId)
```

#### Record Editing

```typescript
import { useRecordEditMode } from "@/contexts/EditModeContext"

const { isEditing, toggle, enter, exit, editingRecordId } = useRecordEditMode(recordId)
```

#### Grid Editing

```typescript
import { useGridEditMode } from "@/contexts/EditModeContext"

const { isEditing, toggle, enter, exit } = useGridEditMode(tableId, viewId)
```

## Migration

### Components Updated

1. **SidebarModeContext** - Now wraps EditModeContext for backward compatibility
2. **InterfacePageClient** - Uses `usePageEditMode` and `useBlockEditMode`
3. **InterfaceBuilder** - Uses `useBlockEditMode` for block editing
4. **GroupedInterfaces** - Uses SidebarModeContext (which wraps unified context)
5. **WorkspaceShellWrapper** - Includes EditModeProvider

### Backward Compatibility

The `SidebarModeContext` is maintained for backward compatibility but now delegates to the unified `EditModeContext`. Existing components using `useSidebarMode()` continue to work without changes.

## Benefits

1. **Consistency** - Single API for all editing states
2. **Maintainability** - One place to manage editing logic
3. **Extensibility** - Easy to add new editing scopes
4. **State Management** - Clear tracking of what's being edited
5. **Persistence** - Automatic localStorage persistence per scope

## Future Enhancements

- Add undo/redo support per editing scope
- Add conflict detection when multiple users edit simultaneously
- Add editing history/audit trail
- Add editing permissions per scope


