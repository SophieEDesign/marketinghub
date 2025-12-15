<template>
  <div class="view-blocks-wrapper">
    <!-- Add Block Button (only in edit mode) -->
    <AddBlockButton
      v-if="editMode"
      :current-blocks="blocks"
      @add-block="handleAddBlock"
    />

    <!-- Block Settings Drawer -->
    <BlockSettingsDrawer
      :open="settingsDrawerOpen"
      :block="selectedBlock"
      @close="closeSettingsDrawer"
      @save="handleBlockSave"
      @delete="handleBlockDelete"
    />

    <!-- Interface Grid Layout -->
    <InterfaceGridLayout
      :blocks="blocks"
      :edit-mode="editMode"
      :user="user"
      @blocks-change="handleBlocksChange"
      @open-settings="openSettingsDrawer"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import InterfaceGridLayout from './InterfaceGridLayout.vue'
import AddBlockButton from './AddBlockButton.vue'
import BlockSettingsDrawer from './BlockSettingsDrawer.vue'
import type { BlockConfig } from '~/blocks/blockRegistry'

interface Props {
  viewId: string
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

const settingsDrawerOpen = ref(false)
const selectedBlock = ref<BlockConfig | null>(null)

// Handle adding a new block
const handleAddBlock = (block: BlockConfig) => {
  const updatedBlocks = [...props.blocks, block]
  emit('blocksChange', updatedBlocks)
  props.onBlocksChange?.(updatedBlocks)
  
  // Open settings for the new block
  selectedBlock.value = block
  settingsDrawerOpen.value = true
}

// Handle blocks change (from grid layout)
const handleBlocksChange = (blocks: BlockConfig[]) => {
  emit('blocksChange', blocks)
  props.onBlocksChange?.(blocks)
}

// Handle block save (from settings drawer)
const handleBlockSave = (block: BlockConfig) => {
  const updatedBlocks = props.blocks.map((b) =>
    b.id === block.id ? block : b
  )
  emit('blocksChange', updatedBlocks)
  props.onBlocksChange?.(updatedBlocks)
}

// Handle block delete
const handleBlockDelete = (blockId: string) => {
  const updatedBlocks = props.blocks.filter((b) => b.id !== blockId)
  emit('blocksChange', updatedBlocks)
  props.onBlocksChange?.(updatedBlocks)
  closeSettingsDrawer()
}

// Open settings drawer
const openSettingsDrawer = (blockId: string) => {
  selectedBlock.value = props.blocks.find((b) => b.id === blockId) || null
  settingsDrawerOpen.value = true
}

// Close settings drawer
const closeSettingsDrawer = () => {
  settingsDrawerOpen.value = false
  selectedBlock.value = null
}
</script>

<style scoped>
.view-blocks-wrapper {
  @apply relative w-full;
}
</style>
