<template>
  <div class="add-block-button-container">
    <a-dropdown :trigger="['click']" placement="bottomLeft">
      <a-button type="primary" class="add-block-btn">
        <Icon name="mdi:plus" class="mr-2" />
        {{ $t('activity.addBlock') }}
      </a-button>
      <template #overlay>
        <a-menu @click="handleBlockSelect">
          <a-menu-item-group
            v-for="category in blockCategories"
            :key="category.name"
            :title="category.label"
          >
            <a-menu-item
              v-for="blockType in category.blocks"
              :key="blockType.id"
              :value="blockType.id"
            >
              <Icon :name="blockType.icon || 'mdi:cube'" class="mr-2" />
              {{ blockType.label }}
              <span v-if="blockType.description" class="text-gray-400 text-xs ml-2">
                {{ blockType.description }}
              </span>
            </a-menu-item>
          </a-menu-item-group>
        </a-menu>
      </template>
    </a-dropdown>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getAllBlockTypes, getBlockTypesByCategory, createBlock, type BlockConfig } from '~/blocks/blockRegistry'
import { getNextPosition } from '~/utils/gridUtils'
import type { Layout } from 'vue-grid-layout'

interface Props {
  currentBlocks: BlockConfig[]
  onAddBlock?: (block: BlockConfig) => void
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'addBlock', block: BlockConfig): void
}>()

// Group blocks by category
const blockCategories = computed(() => {
  const categories = [
    { name: 'content', label: 'Content', blocks: getBlockTypesByCategory('content') },
    { name: 'data', label: 'Data', blocks: getBlockTypesByCategory('data') },
    { name: 'layout', label: 'Layout', blocks: getBlockTypesByCategory('layout') },
    { name: 'automation', label: 'Automation', blocks: getBlockTypesByCategory('automation') },
  ]

  return categories.filter((cat) => cat.blocks.length > 0)
})

const handleBlockSelect = ({ key }: { key: string }) => {
  // Convert current blocks to layout format for position calculation
  const currentLayout: Layout[] = props.currentBlocks.map((block) => ({
    i: block.id,
    x: block.position.x,
    y: block.position.y,
    w: block.position.w,
    h: block.position.h,
  }))

  // Calculate next position
  const nextPos = getNextPosition(currentLayout, { w: 6, h: 3 })

  // Create new block
  const newBlock = createBlock(key, nextPos)

  emit('addBlock', newBlock)
  props.onAddBlock?.(newBlock)
}
</script>

<style scoped>
.add-block-button-container {
  @apply fixed bottom-6 right-6 z-50;
}

.add-block-btn {
  @apply shadow-lg;
}
</style>
