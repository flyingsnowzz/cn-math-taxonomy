<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{ svg?: string }>()

const container = ref<HTMLElement | null>(null)

const svgDocument = computed<DocumentFragment | null>(() => {
  const value = props.svg
  if (typeof value !== 'string' || !value.trim().startsWith('<svg')) return null
  const strippedNamespace = value.replace('xmlns="http://www.w3.org/2000/svg"', '')
  if (/<\s*script|foreignObject|<\s*image\b|https?:\/\//i.test(strippedNamespace)) return null

  const template = document.createElement('template')
  template.innerHTML = value
  const svg = template.content.querySelector('svg')
  if (!svg) return null
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  return template.content
})

async function renderFigure(documentFragment: DocumentFragment | null) {
  await nextTick()
  if (!container.value) return
  container.value.replaceChildren(documentFragment?.cloneNode(true) ?? '')
}

watch(svgDocument, renderFigure, { immediate: true })
</script>

<template>
  <div v-if="svgDocument" ref="container" class="q-figure" />
</template>

<style scoped>
.q-figure {
  overflow-x: auto;
  border-radius: 1rem;
  background: #f8fafc;
  padding: 0.75rem;
}

.q-figure :deep(svg) {
  display: block;
  width: 100%;
  max-width: 320px;
  height: auto;
  margin: 0 auto;
}
</style>
