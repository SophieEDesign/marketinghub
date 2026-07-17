# Versioning System Integration Guide

## Overview

The versioning system provides:
- **Version History**: Snapshots of entity state at different points in time
- **Undo/Redo**: Client-side undo/redo with server sync
- **Activity Logging**: Audit trail of all actions

## Database Schema

Run the migration:
```sql
-- Run: baserow-app/supabase/migrations/create_versioning_system.sql
```

This creates:
- `entity_versions` - Stores snapshots
- `entity_activity_log` - Stores audit trail
- `entity_version_config` - Stores versioning configuration per entity

## Integration Points

### 1. InterfaceBuilder Save Flow

Add versioning to `saveLayout` function in `InterfaceBuilder.tsx`:

```typescript
import { createVersionOnSave, createPageSnapshot, logBlockActivity } from '@/lib/versioning/integration'

const saveLayout = useCallback(async (layout: LayoutItem[]) => {
  // ... existing save logic ...
  
  if (response.ok) {
    // Create version snapshot
    const snapshot = createPageSnapshot(blocks, layout)
    await createVersionOnSave('page', page.id, snapshot, 'autosave')
    
    // ... rest of success handling ...
  }
}, [page.id, blocks])
```

### 2. Block Operations

Add activity logging to block operations:

```typescript
// In handleAddBlock
await logBlockActivity(page.id, 'create', block.id, { type: block.type })

// In handleDeleteBlock
await logBlockActivity(page.id, 'delete', blockId)

// In handleBlockUpdate
await logBlockActivity(page.id, 'update', blockId, { field: 'config' })
```

### 3. Undo/Redo Integration

Add undo/redo hook to InterfaceBuilder:

```typescript
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { createPageSnapshot } from '@/lib/versioning/integration'

// In InterfaceBuilder component
const {
  state: undoRedoState,
  setState: setUndoRedoState,
  undo,
  redo,
  canUndo,
  canRedo,
} = useUndoRedo(createPageSnapshot(blocks), {
  maxHistory: 50,
  debounceMs: 300,
  onStateChange: (snapshot) => {
    // Restore blocks from snapshot
    setBlocks(snapshot.blocks)
  },
  syncToServer: async (snapshot) => {
    // Optional: sync undo/redo state to server
  },
})

// Update state when blocks change
useEffect(() => {
  if (!isUndoRedoRef.current) {
    setUndoRedoState(createPageSnapshot(blocks), false)
  }
}, [blocks])
```

### 4. Manual Save Button

Add explicit version creation on "Done" button:

```typescript
const handleExitEditMode = async () => {
  // Save pending layout
  if (pendingLayout) {
    await saveLayout(pendingLayout)
  }
  
  // Create manual save version
  const snapshot = createPageSnapshot(blocks, pendingLayout || currentLayout)
  await createVersionOnSave('page', page.id, snapshot, 'manual_save')
  
  setIsEditing(false)
}
```

## API Endpoints

### Create Version
```
POST /api/versioning/versions
Body: { entity_type, entity_id, snapshot, reason }
```

### Get Versions
```
GET /api/versioning/versions?entity_type=page&entity_id=xxx&limit=50
```

### Restore Version
```
POST /api/versioning/versions/restore
Body: { entity_type, entity_id, version_number }
```

### Log Activity
```
POST /api/versioning/activity
Body: { entity_type, entity_id, action, metadata, related_entity_type, related_entity_id }
```

### Get Activity Log
```
GET /api/versioning/activity?entity_type=page&entity_id=xxx&limit=50
```

## Keyboard Shortcuts

- **Cmd/Ctrl + Z**: Undo
- **Cmd/Ctrl + Shift + Z**: Redo

These are automatically handled by the `useUndoRedo` hook.

## Version History UI

The `VersionHistoryPanel` component is already integrated into `PageSettingsDrawer`. Users can:
- View all versions
- Preview version snapshots
- Restore previous versions

## Safety Features

1. **No Data Loss**: Restoring a version creates a new version entry, preserving history
2. **Confirmation Dialogs**: Restore operations require confirmation
3. **Schema Validation**: (To be implemented) Prevent restoring incompatible versions
4. **Automatic Cleanup**: Old versions are automatically cleaned up based on `max_versions` config

## Configuration

Versioning behavior can be configured per entity:

```typescript
import { getVersionConfig, updateVersionConfig } from '@/lib/versioning/versioning'

// Get config
const config = await getVersionConfig('page', pageId)

// Update config
await updateVersionConfig('page', pageId, {
  max_versions: 50,
  auto_save_enabled: true,
  auto_save_interval_seconds: 60,
})
```

## Next Steps

1. ✅ Database schema created
2. ✅ Versioning helpers implemented
3. ✅ Undo/redo hook created
4. ✅ Version history UI created
5. ⏳ Integrate into InterfaceBuilder save flows (see integration points above)
6. ⏳ Add versioning to other entity types (views, blocks, automations)

