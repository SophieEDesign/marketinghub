<template>
  <div class="interface-grid-layout" :class="{ 'edit-mode': editMode }">
    <!-- Edit mode with drag-and-drop (requires vue-grid-layout or similar) -->
    <!-- For now, using CSS Grid with manual positioning -->
    <div
      v-if="editMode"
      class="grid-container"
      :style="gridContainerStyle"
    >
      <div
        v-for="block in blocks"
        :key="block.id"
        class="grid-item"
        :class="{ 'dragging': draggingBlockId === block.id }"
        :style="getBlockStyle(block)"
        @mousedown="() => setDraggingBlockId(block.id)"
      >
        <InterfaceBlockRenderer
          :block="block"
          :edit-mode="editMode"
          :is-dragging="draggingBlockId === block.id"
          :user="user"
          :on-update="handleBlockUpdate"
          :on-delete="handleBlockDelete"
          :on-open-settings="() => openBlockSettings(block.id)"
          :on-drag-start="() => setDraggingBlockId(block.id)"
        />
      </div>
    </div>

    <!-- Static layout for view mode -->
    <div v-else class="static-layout">
      <div
        v-for="block in blocks"
        :key="block.id"
        class="static-block"
        :style="getBlockStyle(block)"
      >
        <InterfaceBlockRenderer
          :block="block"
          :edit-mode="false"
          :user="user"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import InterfaceBlockRenderer from './InterfaceBlockRenderer.vue'
import type { BlockConfig } from '~/blocks/blockRegistry'

interface Props {
  blocks: BlockConfig[]
  editMode?: boolean
  user?: any
  onBlocksChange?: (blocks: BlockConfig[]) => void
}

const props = withDefaults(defineProps<Props>(), {
  editMode: false,
  blocks: () => [],
})

const emit = defineEmits<{
  (e: 'blocksChange', blocks: BlockConfig[]): void
}>()

const draggingBlockId = ref<string | null>(null)

// Grid container style (12 columns)
const gridContainerStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(12, 1fr)',
  gap: '16px',
  padding: '16px',
  minHeight: '400px',
}))

// Handle block update
const handleBlockUpdate = (id: string, updates: Partial<BlockConfig>) => {
  const updatedBlocks = props.blocks.map((block) =>
    block.id === id ? { ...block, ...updates } : block
  )
  emit('blocksChange', updatedBlocks)
  props.onBlocksChange?.(updatedBlocks)
}

// Handle block delete
const handleBlockDelete = (id: string) => {
  const updatedBlocks = props.blocks.filter((block) => block.id !== id)
  emit('blocksChange', updatedBlocks)
  props.onBlocksChange?.(updatedBlocks)
}

// Open block settings
const openBlockSettings = (blockId: string) => {
  emit('openSettings', blockId)
}

// Set dragging block ID
const setDraggingBlockId = (id: string) => {
  draggingBlockId.value = id
}

// Handle position update (for drag operations)
const handlePositionUpdate = (blockId: string, newPosition: { x: number; y: number; w: number; h: number }) => {
  handleBlockUpdate(blockId, { position: newPosition })
}

// Get block style for static layout
const getBlockStyle = (block: BlockConfig) => {
  // Calculate position based on grid (12 columns, 50px row height)
  const colWidth = (100 / 12) * block.position.w
  const rowHeight = 50 * block.position.h
  const left = (100 / 12) * block.position.x
  const top = 50 * block.position.y

  return {
    position: 'absolute',
    left: `${left}%`,
    top: `${top}px`,
    width: `${colWidth}%`,
    height: `${rowHeight}px`,
    margin: '8px',
  }
}
</script>

<style scoped>
.interface-grid-layout {
  @apply relative w-full min-h-[400px];
}

.grid-container {
  @apply relative;
}

.grid-item {
  @apply transition-all duration-200;
}

.grid-item.dragging {
  @apply opacity-50 z-50;
  cursor: move;
}

.static-layout {
  @apply relative w-full;
  min-height: 400px;
}

.static-block {
  @apply transition-all duration-200;
}
</style>
