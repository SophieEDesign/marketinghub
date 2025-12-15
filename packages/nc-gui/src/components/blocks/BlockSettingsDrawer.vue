<template>
  <a-drawer
    :open="open"
    :title="blockTitle"
    :width="500"
    @close="onClose"
  >
    <div v-if="block" class="block-settings">
      <!-- Block Title -->
      <div class="setting-section">
        <label class="setting-label">{{ $t('labels.title') }}</label>
        <a-input
          v-model:value="localSettings.title"
          :placeholder="$t('labels.blockTitle')"
          @change="handleSettingsChange"
        />
      </div>

      <!-- Block Type Specific Settings -->
      <div class="setting-section">
        <component
          :is="settingsComponent"
          v-if="settingsComponent"
          v-model:settings="localSettings"
          @update:settings="handleSettingsChange"
        />
      </div>

      <!-- Visibility Rules -->
      <div class="setting-section">
        <label class="setting-label">{{ $t('labels.visibility') }}</label>
        <a-select
          v-model:value="localVisibility.mode"
          @change="handleVisibilityChange"
        >
          <a-select-option value="public">{{ $t('labels.public') }}</a-select-option>
          <a-select-option value="authenticated">{{ $t('labels.authenticated') }}</a-select-option>
          <a-select-option value="role">{{ $t('labels.roleBased') }}</a-select-option>
          <a-select-option value="condition">{{ $t('labels.conditional') }}</a-select-option>
        </a-select>

        <!-- Role selection for role-based visibility -->
        <div v-if="localVisibility.mode === 'role'" class="mt-2">
          <a-select
            v-model:value="localVisibility.roles"
            mode="multiple"
            :placeholder="$t('labels.selectRoles')"
            @change="handleVisibilityChange"
          >
            <a-select-option value="admin">Admin</a-select-option>
            <a-select-option value="editor">Editor</a-select-option>
            <a-select-option value="viewer">Viewer</a-select-option>
            <a-select-option value="client">Client</a-select-option>
            <a-select-option value="ops">Operations</a-select-option>
            <a-select-option value="marketing">Marketing</a-select-option>
          </a-select>
        </div>
      </div>

      <!-- Delete Block -->
      <div class="setting-section danger-zone">
        <a-button type="primary" danger @click="handleDelete">
          <Icon name="mdi:delete" class="mr-2" />
          {{ $t('activity.deleteBlock') }}
        </a-button>
      </div>
    </div>

    <template #footer>
      <div class="drawer-footer">
        <a-button @click="onClose">{{ $t('general.cancel') }}</a-button>
        <a-button type="primary" @click="handleSave">
          {{ $t('general.save') }}
        </a-button>
      </div>
    </template>
  </a-drawer>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { getBlockType, type BlockConfig } from '~/blocks/blockRegistry'

interface Props {
  open: boolean
  block: BlockConfig | null
  onClose: () => void
  onSave?: (block: BlockConfig) => void
  onDelete?: (blockId: string) => void
}

const props = defineProps<Props>()

const localSettings = ref<any>({})
const localVisibility = ref<any>({})

const blockType = computed(() => {
  if (!props.block) return null
  return getBlockType(props.block.type)
})

const settingsComponent = computed(() => {
  if (!blockType.value?.settingsComponent) return null
  return blockType.value.settingsComponent
})

const blockTitle = computed(() => {
  if (!props.block) return ''
  return props.block.settings?.title || blockType.value?.label || props.block.type
})

watch(
  () => props.block,
  (newBlock) => {
    if (newBlock) {
      localSettings.value = { ...newBlock.settings }
      localVisibility.value = { ...newBlock.visibility } || { mode: 'public' }
    }
  },
  { immediate: true }
)

const handleSettingsChange = () => {
  // Auto-save on change (debounced)
}

const handleVisibilityChange = () => {
  // Auto-save on change
}

const handleSave = () => {
  if (!props.block) return

  const updatedBlock: BlockConfig = {
    ...props.block,
    settings: { ...localSettings.value },
    visibility: { ...localVisibility.value },
  }

  props.onSave?.(updatedBlock)
  props.onClose()
}

const handleDelete = () => {
  if (!props.block) return
  if (confirm('Are you sure you want to delete this block?')) {
    props.onDelete?.(props.block.id)
    props.onClose()
  }
}
</script>

<style scoped>
.block-settings {
  @apply space-y-4;
}

.setting-section {
  @apply mb-4;
}

.setting-label {
  @apply block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300;
}

.danger-zone {
  @apply mt-8 pt-4 border-t border-gray-200 dark:border-gray-700;
}

.drawer-footer {
  @apply flex justify-end gap-2;
}
</style>
