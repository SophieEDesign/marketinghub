<template>
  <div
    v-if="shouldRender"
    class="interface-block"
    :class="{ 'block-editing': editMode, 'block-dragging': isDragging }"
  >
    <!-- Block Header (only in edit mode) -->
    <div v-if="editMode" class="block-header">
      <div class="block-handle" @mousedown="onDragStart">
        <Icon name="mdi:drag" class="drag-icon" />
      </div>
      <span class="block-title">{{ blockTitle }}</span>
      <div class="block-actions">
        <button
          class="action-btn"
          @click="onOpenSettings"
          :title="$t('settings')"
        >
          <Icon name="mdi:cog" />
        </button>
        <button
          v-if="onDelete"
          class="action-btn danger"
          @click="onDelete"
          :title="$t('delete')"
        >
          <Icon name="mdi:delete" />
        </button>
      </div>
    </div>

    <!-- Block Content -->
    <div class="block-content">
      <component
        :is="blockComponent"
        v-bind="blockProps"
        :editing="editMode"
        :is-dragging="isDragging"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { getBlockType, type BlockConfig } from '~/blocks/blockRegistry'
import { checkBlockAccess } from '~/helpers/viewAccessControl'

interface Props {
  block: BlockConfig
  editMode?: boolean
  isDragging?: boolean
  user?: any
  onUpdate?: (id: string, updates: Partial<BlockConfig>) => void
  onDelete?: (id: string) => void
  onOpenSettings?: () => void
  onDragStart?: (e: MouseEvent) => void
}

const props = withDefaults(defineProps<Props>(), {
  editMode: false,
  isDragging: false,
})

const blockType = computed(() => getBlockType(props.block.type))
const blockComponent = computed(() => {
  if (!blockType.value) return null
  return defineAsyncComponent(() => blockType.value.component as any)
})

const blockTitle = computed(() => {
  return props.block.settings?.title || blockType.value?.label || props.block.type
})

const blockProps = computed(() => ({
  id: props.block.id,
  content: props.block.settings,
  onUpdate: (id: string, content: any) => {
    props.onUpdate?.(props.block.id, { settings: { ...props.block.settings, ...content } })
  },
  onDelete: props.onDelete ? () => props.onDelete?.(props.block.id) : undefined,
  onOpenSettings: props.onOpenSettings,
  isDragging: props.isDragging,
  editing: props.editMode,
}))

// Check if block should be rendered based on visibility rules
const shouldRender = computed(() => {
  // Always render in edit mode
  if (props.editMode) return true

  // Use access control helper
  return checkBlockAccess(props.block, props.user)
})

const onDragStart = (e: MouseEvent) => {
  props.onDragStart?.(e)
}
</script>

<style scoped>
.interface-block {
  @apply bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm;
  @apply transition-all duration-200;
}

.interface-block.block-editing {
  @apply border-blue-300 dark:border-blue-600;
}

.interface-block.block-dragging {
  @apply opacity-50 shadow-lg;
}

.block-header {
  @apply flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700;
  @apply bg-gray-50 dark:bg-gray-900;
}

.block-handle {
  @apply cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300;
}

.block-title {
  @apply flex-1 text-sm font-medium text-gray-700 dark:text-gray-300;
}

.block-actions {
  @apply flex items-center gap-1;
}

.action-btn {
  @apply p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300;
  @apply transition-colors;
}

.action-btn.danger {
  @apply hover:text-red-600 dark:hover:text-red-400;
}

.block-content {
  @apply p-4;
}
</style>
