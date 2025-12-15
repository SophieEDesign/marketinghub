<template>
  <div class="text-block">
    <div
      v-if="!editing"
      class="text-content prose prose-sm max-w-none dark:prose-invert"
      v-html="content.html || content.text || ''"
    />
    <div v-else class="text-editor">
      <!-- Use NocoDB's rich text editor component if available -->
      <LazyTiptapEditor
        v-model="localContent"
        :editable="editing"
        @update:model-value="handleContentChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  id: string
  content: {
    title?: string
    html?: string
    text?: string
    alignment?: string
  }
  editing?: boolean
  isDragging?: boolean
  onUpdate?: (id: string, content: any) => void
}

const props = defineProps<Props>()

const localContent = ref(props.content?.html || props.content?.text || '')

watch(
  () => props.content?.html || props.content?.text,
  (newContent) => {
    if (newContent && newContent !== localContent.value) {
      localContent.value = newContent
    }
  }
)

let saveTimeout: NodeJS.Timeout | null = null

const handleContentChange = (html: string) => {
  localContent.value = html
  // Debounce auto-save
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    props.onUpdate?.(props.id, { html, text: html })
  }, 500)
}
</script>

<style scoped>
.text-block {
  @apply w-full h-full;
}

.text-content {
  @apply p-4;
}

.text-editor {
  @apply w-full h-full;
}
</style>
