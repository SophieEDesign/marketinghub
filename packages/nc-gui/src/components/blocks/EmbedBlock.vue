<template>
  <div class="embed-block">
    <iframe
      v-if="content.url && !editing"
      :src="content.url"
      :width="content.width || '100%'"
      :height="content.height || '400px'"
      frameborder="0"
      class="embed-iframe"
    />
    <div v-else-if="editing" class="embed-editor">
      <a-input
        v-model:value="localUrl"
        :placeholder="$t('labels.embedUrl')"
        @change="handleContentChange"
      />
      <div class="mt-2 flex gap-2">
        <a-input
          v-model:value="localWidth"
          :placeholder="$t('labels.width')"
          style="width: 50%"
          @change="handleContentChange"
        />
        <a-input
          v-model:value="localHeight"
          :placeholder="$t('labels.height')"
          style="width: 50%"
          @change="handleContentChange"
        />
      </div>
    </div>
    <div v-else class="placeholder">
      {{ $t('labels.noEmbed') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  id: string
  content: {
    title?: string
    url?: string
    width?: string
    height?: string
  }
  editing?: boolean
  onUpdate?: (id: string, content: any) => void
}

const props = defineProps<Props>()

const localUrl = ref(props.content?.url || '')
const localWidth = ref(props.content?.width || '100%')
const localHeight = ref(props.content?.height || '400px')

watch(
  () => props.content,
  (newContent) => {
    localUrl.value = newContent?.url || ''
    localWidth.value = newContent?.width || '100%'
    localHeight.value = newContent?.height || '400px'
  },
  { deep: true }
)

const handleContentChange = () => {
  props.onUpdate?.(props.id, {
    url: localUrl.value,
    width: localWidth.value,
    height: localHeight.value,
  })
}
</script>

<style scoped>
.embed-block {
  @apply w-full h-full;
}

.embed-iframe {
  @apply w-full;
}

.embed-editor {
  @apply w-full p-4;
}

.placeholder {
  @apply text-gray-400 dark:text-gray-500 text-center p-4;
}
</style>
