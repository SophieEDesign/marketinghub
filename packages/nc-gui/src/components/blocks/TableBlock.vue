<template>
  <div class="table-block">
    <div v-if="loading" class="loading">
      <a-spin />
    </div>
    <div v-else-if="error" class="error">
      {{ error }}
    </div>
    <a-table
      v-else
      :columns="tableColumns"
      :data-source="tableData"
      :pagination="{ pageSize: content.limit || 10 }"
      size="small"
    />
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
    columns?: string[]
    filters?: any[]
    limit?: number
  }
  editing?: boolean
  onUpdate?: (id: string, content: any) => void
}

const props = defineProps<Props>()

const { api } = useApi()
const loading = ref(false)
const error = ref<string | null>(null)
const tableData = ref<any[]>([])

const tableColumns = computed(() => {
  if (!props.content.columns || props.content.columns.length === 0) {
    // Auto-detect columns from data
    if (tableData.value.length > 0) {
      return Object.keys(tableData.value[0]).map((key) => ({
        title: key,
        dataIndex: key,
        key,
      }))
    }
    return []
  }
  return props.content.columns.map((col) => ({
    title: col,
    dataIndex: col,
    key: col,
  }))
})

watch(
  () => [props.content.table, props.content.columns, props.content.filters],
  async () => {
    if (props.content.table) {
      await loadTableData()
    }
  },
  { immediate: true }
)

const loadTableData = async () => {
  if (!props.content.table) return

  loading.value = true
  error.value = null
  try {
    // Use NocoDB API to query data
    const response = await api.get(`/api/v1/db/data/${props.content.table}`, {
      params: {
        limit: props.content.limit || 10,
      },
    })
    tableData.value = response.data?.list || []
  } catch (err: any) {
    error.value = err.message || 'Error loading table data'
    tableData.value = []
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.table-block {
  @apply w-full h-full;
}

.loading,
.error {
  @apply flex items-center justify-center p-4;
}
</style>
