# Phase 2 Integration Summary: Block System for NocoDB Views

## Overview
This document tracks all changes made to integrate the Marketing Hub block system into NocoDB views, allowing each view to become a full "Interface Page" with blocks and layouts.

---

## 1. DATABASE CHANGES ✅

### Files Created:
- ✅ `packages/nocodb/src/db/migrations/add-blocks-to-views.sql` - Database migration

### Database Changes:
```sql
ALTER TABLE nc_views
  ADD COLUMN IF NOT EXISTS blocks jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_nc_views_blocks ON nc_views USING gin (blocks);
```

### Block Structure:
```typescript
{
  id: string,
  type: "text" | "html" | "kpi" | "chart" | "embed" | "table" | "image" | "automation" | "separator",
  position: { x: number, y: number, w: number, h: number },
  settings: { ...type-specific },
  visibility?: {
    mode?: "public" | "authenticated" | "role" | "condition",
    roles?: string[],
    condition?: { field, operator, value }
  }
}
```

---

## 2. BLOCK REGISTRY ✅

### Files Created:
- ✅ `packages/nc-gui/src/blocks/blockRegistry.ts` - Block types registry

### Block Types Registered:
- **text** - Rich text content block
- **html** - Raw HTML content
- **kpi** - Key performance indicator
- **chart** - Data visualization
- **table** - Data table display
- **image** - Image display
- **embed** - External content embed
- **automation** - Automation trigger button
- **separator** - Visual separator

### Functions:
- `getBlockType(typeId)` - Get block type by ID
- `getAllBlockTypes()` - Get all block types
- `getBlockTypesByCategory(category)` - Get blocks by category
- `createBlock(typeId, position)` - Create new block with defaults

---

## 3. BLOCK RENDERER ✅

### Files Created:
- ✅ `packages/nc-gui/src/components/blocks/InterfaceBlockRenderer.vue` - Main block renderer

### Features:
- Dynamically loads block component from registry
- Shows block header with drag handle (edit mode)
- Settings and delete buttons (edit mode)
- Conditional visibility based on rules
- Role-based access control
- Supports both edit and view modes

---

## 4. GRID LAYOUT ✅

### Files Created:
- ✅ `packages/nc-gui/src/components/blocks/InterfaceGridLayout.vue` - Grid layout component
- ✅ `packages/nc-gui/src/utils/gridUtils.ts` - Grid utility functions

### Features:
- CSS Grid-based layout (12 columns)
- Edit mode with drag handles
- View mode with static positioning
- Smart reflow algorithm (pushes blocks down)
- Position calculation helpers

### Note:
- Currently uses CSS Grid (simple implementation)
- Can be upgraded to `vue-grid-layout` for full drag-and-drop if needed
- Add dependency: `pnpm add vue-grid-layout` if drag-and-drop is required

---

## 5. BLOCK COMPONENTS ✅

### Files Created:
- ✅ `packages/nc-gui/src/components/blocks/TextBlock.vue` - Text block component
- ✅ `packages/nc-gui/src/components/blocks/HtmlBlock.vue` - HTML block component
- ✅ `packages/nc-gui/src/components/blocks/KpiBlock.vue` - KPI block component
- ✅ `packages/nc-gui/src/components/blocks/ChartBlock.vue` - Chart block component (placeholder)
- ✅ `packages/nc-gui/src/components/blocks/TableBlock.vue` - Table block component
- ✅ `packages/nc-gui/src/components/blocks/ImageBlock.vue` - Image block component
- ✅ `packages/nc-gui/src/components/blocks/EmbedBlock.vue` - Embed block component
- ✅ `packages/nc-gui/src/components/blocks/AutomationBlock.vue` - Automation block component
- ✅ `packages/nc-gui/src/components/blocks/SeparatorBlock.vue` - Separator block component

### Notes:
- All block components are Vue 3 Composition API
- ChartBlock needs Chart.js integration (Chart.js is already in dependencies)
- Components use NocoDB's API client and composables
- Some blocks may need refinement based on NocoDB's data structure

### Porting Guide:
- Convert React components to Vue 3 Composition API
- Use `<script setup lang="ts">`
- Replace React hooks with Vue composables
- Use NocoDB's TipTap editor for text blocks
- Use NocoDB's API client for data fetching

---

## 6. ADD BLOCK BUTTON ✅

### Files Created:
- ✅ `packages/nc-gui/src/components/blocks/AddBlockButton.vue`

### Features:
- Floating action button
- Dropdown menu with categorized block types
- Calculates next available position
- Opens settings drawer after creation

---

## 7. BLOCK SETTINGS DRAWER ✅

### Files Created:
- ✅ `packages/nc-gui/src/components/blocks/BlockSettingsDrawer.vue`

### Features:
- Title editing
- Type-specific settings (via settingsComponent from registry)
- Visibility rules configuration
- Role-based access control
- Delete block button

---

## 8. VIEW WRAPPER COMPONENT ✅

### Files Created:
- ✅ `packages/nc-gui/src/components/blocks/ViewBlocksWrapper.vue`

### Features:
- Wraps InterfaceGridLayout
- Manages AddBlockButton visibility
- Manages BlockSettingsDrawer state
- Handles all block operations (add, update, delete)

---

## 9. PERSISTENCE LAYER ✅

### Files Modified:
- ✅ `packages/nocodb/src/services/views.service.ts` - Added block methods
- ✅ `packages/nocodb/src/controllers/views.controller.ts` - Added block endpoints

### New Service Methods:
- `getBlocks(context, { viewId })` - Get blocks for a view
- `updateBlocks(context, { viewId, blocks, user, req })` - Update blocks for a view
- `getPublicSharedView(context, { publicShareId })` - Get public shared view with blocks

### New API Endpoints:
- `GET /api/v1/db/meta/views/:viewId/blocks` - Get blocks for a view
- `PATCH /api/v1/db/meta/views/:viewId/blocks` - Update blocks for a view
- `GET /api/v1/db/public/shared-view/:publicShareId` - Get public shared view (read-only)

### Implementation:
- Blocks stored in `nc_views.blocks` JSONB column
- Updates only the blocks field (efficient)
- Validates view exists before updating
- Can also use existing `PATCH /api/v1/db/meta/views/:viewId` endpoint with `{ blocks: [...] }` in body

---

## 10. INTEGRATION INTO VIEW COMPONENTS ⚠️

### Files That Need Modification:

1. **Grid View:**
   - `packages/nc-gui/pages/index/[typeOrId]/[baseId]/index/index/[viewId]/[[viewTitle]].vue`
   - Add `<ViewBlocksWrapper>` after `<TabsSmartsheet>`

2. **Kanban View:**
   - `packages/nc-gui/pages/index/kanban/[viewId]/index.vue`
   - Add `<ViewBlocksWrapper>` after kanban board

3. **Gallery View:**
   - `packages/nc-gui/pages/index/gallery/[viewId]/index.vue`
   - Add `<ViewBlocksWrapper>` after gallery

4. **Calendar View:**
   - `packages/nc-gui/pages/index/calendar/[viewId]/index.vue`
   - Add `<ViewBlocksWrapper>` after calendar

5. **Form View:**
   - `packages/nc-gui/pages/index/form/[viewId]/index.vue`
   - Add `<ViewBlocksWrapper>` after form

6. **Row View:**
   - `packages/nc-gui/pages/index/view/[viewId].vue`
   - Add `<ViewBlocksWrapper>` after row detail

### Integration Pattern:
```vue
<template>
  <div class="view-container">
    <!-- Existing view component -->
    <TabsSmartsheet v-if="viewType === 'grid'" />
    <KanbanBoard v-if="viewType === 'kanban'" />
    <!-- etc. -->
    
    <!-- Block system -->
    <ViewBlocksWrapper
      :view-id="viewId"
      :blocks="view.blocks || []"
      :edit-mode="editMode"
      :user="user"
      @blocks-change="handleBlocksChange"
    />
  </div>
</template>
```

---

## 11. PUBLIC SHARE SUPPORT ⚠️

### Files That Need Modification:
- `packages/nc-gui/pages/index/shared/[erdUuid]/index.vue` - Public shared view

### Changes Needed:
- Set `editMode={false}` for public views
- Hide AddBlockButton
- Disable block settings
- Disable drag operations
- Show read-only blocks

---

## 12. AUTOMATION INTEGRATION ⚠️

### Files Needed:
- `packages/nc-gui/src/components/blocks/AutomationBlock.vue`

### Features:
- Button to trigger automation
- Shows automation label
- Confirmation dialog if `confirm: true`
- Calls Marketing Hub automation API
- Passes current row/view context

### API Integration:
```typescript
// Call Marketing Hub automation endpoint
const response = await $api.post(`/api/automations/${automationId}/run`, {
  context: {
    viewId: currentView.id,
    recordId: currentRecord?.id,
    tableId: currentTable.id,
  }
})
```

---

## 13. ACCESS CONTROL ✅

### Implementation:
- Block-level visibility rules in `block.visibility`
- Checked in `InterfaceBlockRenderer.vue`
- Supports: public, authenticated, role, condition
- Integrated with Phase 1 access control system

---

## 14. FILES CREATED SUMMARY

### Backend:
1. ✅ `packages/nocodb/src/db/migrations/add-blocks-to-views.sql` - Database migration
2. ✅ `packages/nocodb/src/services/views.service.ts` (modified - added getBlocks/updateBlocks/getPublicSharedView)
3. ✅ `packages/nocodb/src/controllers/views.controller.ts` (modified - added block endpoints)

### Frontend:
1. ✅ `packages/nc-gui/src/blocks/blockRegistry.ts` - Block types registry
2. ✅ `packages/nc-gui/src/components/blocks/InterfaceBlockRenderer.vue` - Main block renderer
3. ✅ `packages/nc-gui/src/components/blocks/InterfaceGridLayout.vue` - Grid layout component
4. ✅ `packages/nc-gui/src/components/blocks/AddBlockButton.vue` - Add block button
5. ✅ `packages/nc-gui/src/components/blocks/BlockSettingsDrawer.vue` - Settings drawer
6. ✅ `packages/nc-gui/src/components/blocks/ViewBlocksWrapper.vue` - Wrapper component
7. ✅ `packages/nc-gui/src/components/blocks/TextBlock.vue` - Text block
8. ✅ `packages/nc-gui/src/components/blocks/HtmlBlock.vue` - HTML block
9. ✅ `packages/nc-gui/src/components/blocks/KpiBlock.vue` - KPI block
10. ✅ `packages/nc-gui/src/components/blocks/ChartBlock.vue` - Chart block (placeholder)
11. ✅ `packages/nc-gui/src/components/blocks/TableBlock.vue` - Table block
12. ✅ `packages/nc-gui/src/components/blocks/ImageBlock.vue` - Image block
13. ✅ `packages/nc-gui/src/components/blocks/EmbedBlock.vue` - Embed block
14. ✅ `packages/nc-gui/src/components/blocks/AutomationBlock.vue` - Automation block
15. ✅ `packages/nc-gui/src/components/blocks/SeparatorBlock.vue` - Separator block
16. ✅ `packages/nc-gui/src/utils/gridUtils.ts` - Grid utilities
17. ✅ `packages/nc-gui/src/helpers/viewAccessControl.ts` (modified - added checkBlockAccess)
18. ✅ `packages/nc-gui/pages/index/[typeOrId]/[baseId]/index/index/[viewId]/[[viewTitle]]-with-blocks.vue.example` - Integration example

---

## 15. FILES STILL NEEDED

### Block Components (Port from Marketing Hub):
1. `HtmlBlock.vue`
2. `KpiBlock.vue`
3. `ChartBlock.vue`
4. `TableBlock.vue`
5. `ImageBlock.vue`
6. `EmbedBlock.vue`
7. `AutomationBlock.vue`
8. `SeparatorBlock.vue`

### View Integration:
- Modify each view component to include `<ViewBlocksWrapper>`

### API Controller:
- Add block endpoints to view controller (optional - can use existing view update)

---

## 16. DEPENDENCIES

### Optional (for full drag-and-drop):
```bash
cd packages/nc-gui
pnpm add vue-grid-layout
```

### Already Available:
- TipTap (for text editor)
- Ant Design Vue (for UI components)
- Vue 3 Composition API

---

## 17. USAGE EXAMPLE

### In a View Component:
```vue
<script setup lang="ts">
import { ref } from 'vue'
import ViewBlocksWrapper from '~/components/blocks/ViewBlocksWrapper.vue'
import { useViews } from '~/composables/useViews'

const viewId = computed(() => route.params.viewId as string)
const { view, updateView } = useViews(viewId.value)
const editMode = ref(false)

const handleBlocksChange = async (blocks: BlockConfig[]) => {
  await updateView({
    blocks: blocks
  })
}
</script>

<template>
  <div>
    <!-- Existing view content -->
    <TabsSmartsheet />
    
    <!-- Block system -->
    <ViewBlocksWrapper
      :view-id="viewId"
      :blocks="view.blocks || []"
      :edit-mode="editMode"
      :user="user"
      @blocks-change="handleBlocksChange"
    />
  </div>
</template>
```

---

## 18. TESTING CHECKLIST

- [ ] Database migration runs successfully
- [ ] Blocks can be added to views
- [ ] Blocks can be edited and deleted
- [ ] Block layout persists after save
- [ ] Visibility rules work correctly
- [ ] Role-based access control works
- [ ] Public share views show blocks (read-only)
- [ ] All block types render correctly
- [ ] Grid layout positions blocks correctly
- [ ] Settings drawer works for all block types

---

## Notes

- **DO NOT** modify NocoDB's native grid/kanban/calendar logic
- **DO NOT** modify the database view engine
- Blocks are an **addition** to existing views, not a replacement
- All block components should be Vue 3 Composition API
- Use NocoDB's existing UI components and patterns where possible
