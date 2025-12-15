<template>
  <div class="image-block">
    <img
      v-if="content.url && !editing"
      :src="content.url"
      :alt="content.alt || ''"
      :style="{ width: content.width || '100%' }"
      class="block-image"
    />
    <div v-else-if="editing" class="image-editor">
      <a-input
        v-model:value="localUrl"
        :placeholder="$t('labels.imageUrl')"
        @change="handleContentChange"
      />
      <a-input
        v-model:value="localAlt"
        :placeholder="$t('labels.altText')"
        class="mt-2"
        @change="handleContentChange"
      />
    </div>
    <div v-else class="placeholder">
      {{ $t('labels.noImage') }}
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
    alt?: string
    width?: string
  }
  editing?: boolean
  onUpdate?: (id: string, content: any) => void
}

const props = defineProps<Props>()

const localUrl = ref(props.content?.url || '')
const localAlt = ref(props.content?.alt || '')

watch(
  () => props.content,
  (newContent) => {
    localUrl.value = newContent?.url || ''
    localAlt.value = newContent?.alt || ''
  },
  { deep: true }
)

const handleContentChange = () => {
  props.onUpdate?.(props.id, {
    url: localUrl.value,
    alt: localAlt.value,
  })
}
</script>

<style scoped>
.image-block {
  @apply w-full h-full flex items-center justify-center;
}

.block-image {
  @apply max-w-full max-h-full object-contain;
}

.image-editor {
  @apply w-full p-4;
}

.placeholder {
  @apply text-gray-400 dark:text-gray-500 text-center p-4;
}
</style>
