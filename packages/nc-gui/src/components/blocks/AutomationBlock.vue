<template>
  <div class="automation-block">
    <a-button
      :type="content.buttonType || 'primary'"
      :loading="running"
      :disabled="!content.automationId || editing"
      @click="handleRunAutomation"
      class="automation-button"
    >
      <Icon name="mdi:lightning-bolt" class="mr-2" />
      {{ content.label || $t('activity.runAutomation') }}
    </a-button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useApi } from '~/composables/useApi'
import { message } from 'ant-design-vue'

interface Props {
  id: string
  content: {
    title?: string
    automationId?: string
    label?: string
    confirm?: boolean
    buttonType?: 'primary' | 'default' | 'dashed'
  }
  editing?: boolean
  onUpdate?: (id: string, content: any) => void
  recordContext?: any // Current record context
  viewContext?: any // Current view context
}

const props = defineProps<Props>()

const { api } = useApi()
const running = ref(false)

const handleRunAutomation = async () => {
  if (!props.content.automationId) {
    message.error('No automation configured')
    return
  }

  // Show confirmation if required
  if (props.content.confirm) {
    // Use NocoDB's modal component
    // For now, using browser confirm
    if (!confirm(`Run automation: ${props.content.label || props.content.automationId}?`)) {
      return
    }
  }

  running.value = true
  try {
    // Call Marketing Hub automation API
    // Adjust endpoint based on your API structure
    const response = await api.post(`/api/automations/${props.content.automationId}/run`, {
      context: {
        viewId: props.viewContext?.id,
        recordId: props.recordContext?.id,
        tableId: props.viewContext?.fk_model_id,
      },
    })

    message.success('Automation executed successfully')
  } catch (error: any) {
    message.error(error.message || 'Failed to run automation')
  } finally {
    running.value = false
  }
}
</script>

<style scoped>
.automation-block {
  @apply w-full h-full flex items-center justify-center p-4;
}

.automation-button {
  @apply w-full;
}
</style>
