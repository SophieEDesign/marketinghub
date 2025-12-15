<template>
  <div class="chart-block">
    <div v-if="loading" class="loading">
      <a-spin />
    </div>
    <div v-else-if="error" class="error">
      {{ error }}
    </div>
    <div v-else class="chart-container">
      <!-- Placeholder for chart - integrate with Chart.js or similar -->
      <div class="chart-placeholder">
        <Icon name="mdi:chart-bar" class="text-4xl text-gray-400 mb-2" />
        <p class="text-gray-500">{{ $t('labels.chartPlaceholder') }}</p>
        <p class="text-xs text-gray-400 mt-1">
          Chart: {{ content.chartType }} | X: {{ content.xField }} | Y: {{ content.yField }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useApi } from '~/composables/useApi'

interface Props {
  id: string
  content: {
    title?: string
    table?: string
    chartType?: 'bar' | 'line' | 'pie' | 'area'
    xField?: string
    yField?: string
    filters?: any[]
  }
  editing?: boolean
  onUpdate?: (id: string, content: any) => void
}

const props = defineProps<Props>()

const { api } = useApi()
const loading = ref(false)
const error = ref<string | null>(null)

// TODO: Implement chart rendering with Chart.js (already in dependencies)
// For now, showing placeholder
</script>

<style scoped>
.chart-block {
  @apply w-full h-full;
}

.chart-container {
  @apply w-full h-full p-4;
}

.chart-placeholder {
  @apply flex flex-col items-center justify-center h-full text-center;
}

.loading,
.error {
  @apply flex items-center justify-center p-4;
}
</style>
