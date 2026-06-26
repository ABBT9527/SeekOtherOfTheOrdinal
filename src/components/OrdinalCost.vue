<template>
  <span ref="katexEl" class="ordinal-cost"></span>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

interface Props {
  ordinal: string
}

const props = defineProps<Props>()
const katexEl = ref<HTMLElement | null>(null)

function render() {
  if (!katexEl.value || typeof window.katex === 'undefined') return
  if (!props.ordinal) return

  try {
    window.katex.render(props.ordinal, katexEl.value, {
      throwOnError: false,
      displayMode: false,
      trust: true
    })
  } catch (err) {
    console.error('KaTeX render error:', err)
    if (katexEl.value) {
      katexEl.value.textContent = props.ordinal
    }
  }
}

onMounted(render)

watch(() => props.ordinal, render)
</script>

<style scoped>
.ordinal-cost {
  font-family: 'JetBrains Mono', ui-monospace, Consolas, monospace;
}

.ordinal-cost :deep(.katex),
.ordinal-cost :deep(.katex *) {
  font-family: 'JetBrains Mono', ui-monospace, Consolas, monospace !important;
  font-style: normal !important;
  font-weight: 600 !important;
}
</style>
