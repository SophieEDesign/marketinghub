<template>
  <div class="separator-block">
    <div class="separator-line" />
  </div>
</template>

<script setup lang="ts">
interface Props {
  id: string
  content: any
  editing?: boolean
  onUpdate?: (id: string, content: any) => void
}

defineProps<Props>()
</script>

<style scoped>
.separator-block {
  @apply w-full h-full flex items-center justify-center;
}

.separator-line {
  @apply w-full border-t border-gray-200 dark:border-gray-700;
}
</style>
