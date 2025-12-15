<template>
  <div class="html-block">
    <div
      v-if="!editing"
      class="html-content"
      v-html="content.html || ''"
    />
    <div v-else class="html-editor">
      <a-textarea
        v-model:value="localHtml"
        :rows="10"
        :placeholder="$t('labels.enterHtml')"
        @change="handleContentChange"
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
  }
  editing?: boolean
  onUpdate?: (id: string, content: any) => void
}

const props = defineProps<Props>()

const localHtml = ref(props.content?.html || '')

watch(
  () => props.content?.html,
  (newHtml) => {
    if (newHtml && newHtml !== localHtml.value) {
      localHtml.value = newHtml
    }
  }
)

const handleContentChange = () => {
  props.onUpdate?.(props.id, { html: localHtml.value })
}
</script>

<style scoped>
.html-block {
  @apply w-full h-full;
}

.html-content {
  @apply p-4;
}
</style>
