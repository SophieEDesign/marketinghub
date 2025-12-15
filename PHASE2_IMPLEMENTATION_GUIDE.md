# Phase 2 Implementation Guide: Integrating Blocks into NocoDB Views

## Quick Start

### 1. Run Database Migration

In Supabase SQL Editor, run:
```sql
-- File: packages/nocodb/src/db/migrations/add-blocks-to-views.sql
ALTER TABLE nc_views
  ADD COLUMN IF NOT EXISTS blocks jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_nc_views_blocks ON nc_views USING gin (blocks);
```

### 2. Install Dependencies (Optional)

If you want full drag-and-drop functionality:
```bash
cd packages/nc-gui
pnpm add vue-grid-layout
```

Otherwise, the CSS Grid implementation will work for basic layouts.

### 3. Integrate into a View Component

Example for Grid View (`packages/nc-gui/pages/index/[typeOrId]/[baseId]/index/index/[viewId]/[[viewTitle]].vue`):

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import ViewBlocksWrapper from '~/components/blocks/ViewBlocksWrapper.vue'
import type { BlockConfig } from '~/blocks/blockRegistry'

const route = useRoute()
const viewId = computed(() => route.params.viewId as string)

// Get view (adjust based on NocoDB's composables)
const { view, updateView } = useView(viewId.value)
const editMode = ref(false)
const user = computed(() => useUserStore().user)

const handleBlocksChange = async (blocks: BlockConfig[]) => {
  await updateView({ blocks })
}
</script>

<template>
  <div class="w-full h-full relative">
    <!-- Existing NocoDB view -->
    <TabsSmartsheet :active-tab="activeTab" />
    
    <!-- Block system -->
    <ViewBlocksWrapper
      v-if="view"
      :view-id="viewId"
      :blocks="(view.blocks as BlockConfig[]) || []"
      :edit-mode="editMode"
      :user="user"
      @blocks-change="handleBlocksChange"
    />
  </div>
</template>
```

## How It Works

### Block Flow:

1. **User adds block** → `AddBlockButton` creates new `BlockConfig`
2. **Block rendered** → `InterfaceBlockRenderer` loads component from registry
3. **Layout managed** → `InterfaceGridLayout` handles positioning
4. **Settings edited** → `BlockSettingsDrawer` updates block settings
5. **Saved** → `ViewBlocksWrapper` calls `updateView({ blocks })`
6. **Persisted** → Backend stores in `nc_views.blocks` JSONB column

### Access Control:

- Blocks check `block.visibility` rules
- Uses `checkBlockAccess()` helper
- Supports: public, authenticated, role, condition
- Integrated with Phase 1 access control

### Public Share:

- Public views show blocks in read-only mode
- `editMode={false}` disables all editing
- Blocks still respect visibility rules

## Next Steps

1. **Test block system** in a single view first
2. **Integrate into all view types** (grid, kanban, gallery, calendar, form)
3. **Refine block components** based on NocoDB's data structure
4. **Add Chart.js integration** to ChartBlock
5. **Connect AutomationBlock** to Marketing Hub API
6. **Test public share** with blocks

## Troubleshooting

### Blocks not showing:
- Check `view.blocks` is loaded from API
- Verify database migration ran
- Check browser console for errors

### Blocks not saving:
- Verify `updateView` API call succeeds
- Check `nc_views.blocks` column exists
- Verify user has edit permissions

### Drag-and-drop not working:
- Install `vue-grid-layout` if using full drag-and-drop
- CSS Grid version works without drag (position-based)
