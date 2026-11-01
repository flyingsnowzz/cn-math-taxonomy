<script setup lang="ts">
import cytoscape from 'cytoscape'
import cytoscapeDagre from 'cytoscape-dagre'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DependencyEdge, SubjectCode, Topic } from '@/data/types'
import { dagreLayout, graphElements, graphStylesheet } from './graphAdapter'

cytoscape.use(cytoscapeDagre)

const props = defineProps<{
  topics: Topic[]
  edges: DependencyEdge[]
  selectedId: string
  subject: SubjectCode
}>()

const emit = defineEmits<{
  select: [topicId: string]
}>()

const container = ref<HTMLDivElement | null>(null)
let cy: cytoscape.Core | null = null

const elements = computed(() => graphElements(props.topics, props.edges))

function renderGraph() {
  if (!cy) return
  cy.json({ elements: elements.value, style: graphStylesheet(props.subject) })
  cy.layout(dagreLayout).run()
  cy.zoom({ level: 1, renderedPosition: { x: 0, y: 0 } })
  cy.center()
  cy.fit(undefined, 36)
}

function bindEvents() {
  if (!cy) return
  cy.on('tap', 'node', (event) => {
    const id = String(event.target.id())
    emit('select', id)
  })
}

onMounted(() => {
  if (!container.value) return
  cy = cytoscape({
    container: container.value,
    elements: elements.value,
    style: graphStylesheet(props.subject),
    wheelSensitivity: 0.18,
    minZoom: 0.25,
    maxZoom: 2.5,
  })
  bindEvents()
  cy.layout(dagreLayout).run()
  cy.fit(undefined, 36)
})

watch(elements, renderGraph, { deep: false })
watch(
  () => props.selectedId,
  (id) => {
    if (!cy) return
    cy.$id(id).select()
    cy.animate({ center: { eles: `#${CSS.escape(id)}` }, zoom: Math.max(cy.zoom(), 0.9) }, { duration: 220 })
  },
)

onBeforeUnmount(() => {
  cy?.destroy()
  cy = null
})

function zoomBy(factor: number) {
  cy?.zoom({ level: cy.zoom() * factor, renderedPosition: { x: (cy.width() ?? 0) / 2, y: (cy.height() ?? 0) / 2 } })
}
function fit() {
  cy?.fit(undefined, 36)
}
</script>

<template>
  <section class="flex h-full min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
      <div>
        <h2 class="text-base font-semibold text-slate-900">先修关系图</h2>
        <p class="text-xs text-slate-500">实线：硬先修；虚线：软先修。箭头由前置知识指向后续知识。</p>
      </div>
      <div class="flex gap-2">
        <button class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50" @click="zoomBy(0.82)">缩小</button>
        <button class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50" @click="zoomBy(1.22)">放大</button>
        <button class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50" @click="fit">适配画面</button>
      </div>
    </div>
    <div ref="container" class="min-h-0 flex-1 bg-slate-50" />
  </section>
</template>
