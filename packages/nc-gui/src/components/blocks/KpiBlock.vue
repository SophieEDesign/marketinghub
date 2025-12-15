<template>
  <div class="kpi-block">
    <div v-if="loading" class="loading">
      <a-spin />
    </div>
    <div v-else class="kpi-content">
      <div class="kpi-value">{{ formattedValue }}</div>
      <div v-if="content.title" class="kpi-title">{{ content.title }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useApi } from '~/composables/useApi'

interface Props {
  id: string
  content: {
    title?: string
    table?: string
    field?: string
    aggregate?: 'count' | 'sum' | 'avg' | 'min' | 'max'
    filters?: any[]
  }
  editing?: boolean
  onUpdate?: (id: string, content: any) => void
}

const props = defineProps<Props>()

const { api } = useApi()
const loading = ref(false)
const value = ref<number | null>(null)

const formattedValue = computed(() => {
  if (value.value === null) return '—'
  return new Intl.NumberFormat().format(value.value)
})

// Load KPI value
watch(
  () => [props.content.table, props.content.field, props.content.aggregate],
  async () => {
    if (props.content.table && props.content.field) {
      await loadKpiValue()
    }
  },
  { immediate: true }
)

const loadKpiValue = async () => {
  if (!props.content.table || !props.content.field) return

  loading.value = true
  try {
    // Use NocoDB API to query data
    // This is a placeholder - adjust based on NocoDB's API structure
    const response = await api.get(`/api/v1/db/data/${props.content.table}`, {
      params: {
        aggregate: props.content.aggregate || 'count',
        field: props.content.field,
      },
    })
    value.value = response.data?.value || 0
  } catch (error) {
    console.error('Error loading KPI:', error)
    value.value = null
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.kpi-block {
  @apply w-full h-full flex items-center justify-center;
}

.kpi-content {
  @apply text-center;
}

.kpi-value {
  @apply text-3xl font-bold text-gray-900 dark:text-gray-100;
}

.kpi-title {
  @apply text-sm text-gray-500 dark:text-gray-400 mt-2;
}

.loading {
  @apply flex items-center justify-center;
}
</style>
