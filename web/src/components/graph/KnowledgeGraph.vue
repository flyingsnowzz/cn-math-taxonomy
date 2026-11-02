<script setup lang="ts">
import cytoscape from 'cytoscape'
import cytoscapeDagre from 'cytoscape-dagre'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { SubjectCode, Topic } from '@/data/types'
import { dagreLayout, graphElements, graphStylesheet, type GraphEdge, type GraphElementOptions } from './graphAdapter'
import { getSubject } from '@/data/subjectRegistry'

cytoscape.use(cytoscapeDagre)

const props = defineProps<{
  topics: Topic[]
  edges: GraphEdge[]
  selectedId: string
  subject: SubjectCode
  statusById?: GraphElementOptions['statusById']
  rootIds?: GraphElementOptions['rootIds']
  targetIds?: GraphElementOptions['targetIds']
}>()

const emit = defineEmits<{
  select: [topicId: string]
}>()

function getSubjectColor() {
  return getSubject(props.subject).graphColor
}

const container = ref<HTMLDivElement | null>(null)
const hasIndirectEdges = computed(() => props.edges.some((edge) => edge.indirect))
let cy: cytoscape.Core | null = null
let tooltipLocked = false
const tooltip = ref<{ x: number; y: number; text: string } | null>(null)

const elements = computed(() => graphElements(props.topics, props.edges, {
  statusById: props.statusById,
  rootIds: props.rootIds,
  targetIds: props.targetIds,
}))

function renderGraph() {
  if (!cy) return
  cy.json({ elements: elements.value, style: graphStylesheet(props.subject) })
  cy.layout(dagreLayout).run()
  cy.zoom({ level: 1, renderedPosition: { x: 0, y: 0 } })
  cy.center()
  cy.fit(undefined, 36)
}

function showNodeTooltip(event: cytoscape.EventObject) {
  const node = event.target as cytoscape.NodeSingular
  const text = String(node.data('full') ?? node.data('label') ?? node.id())
  if (!text) return
  const box = node.renderedBoundingBox({ includeLabels: true })
  tooltip.value = {
    text,
    x: box.x1 + (box.x2 - box.x1) / 2,
    y: Math.max(box.y1 - 8, 8),
  }
}

function bindEvents() {
  if (!cy) return
  cy.on('mouseover', 'node', (event) => {
    if (!tooltipLocked) showNodeTooltip(event)
  })
  cy.on('mouseout', 'node', () => {
    if (!tooltipLocked) tooltip.value = null
  })
  cy.on('tap', 'node', (event) => {
    const id = String(event.target.id())
    emit('select', id)
    tooltipLocked = true
    showNodeTooltip(event)
  })
  cy.on('tap', (event) => {
    if (event.target === cy) {
      tooltipLocked = false
      tooltip.value = null
    }
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
  cy.on('zoom pan resize', () => {
    tooltipLocked = false
    tooltip.value = null
  })
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
    <div ref="container" class="relative min-h-0 flex-1 bg-slate-50">
      <div
        v-if="tooltip"
        class="pointer-events-none absolute z-10 max-w-72 -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs leading-5 text-white shadow-lg"
        :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
      >
        {{ tooltip.text }}
      </div>
    </div>
    <div class="flex flex-wrap gap-3 border-t border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-500">
      <span class="flex items-center gap-1"><i class="h-2.5 w-2.5 rounded-full bg-[#3e9a8f]" />小学</span>
      <span class="flex items-center gap-1"><i class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: getSubjectColor() }" />初中</span>
      <span class="flex items-center gap-1"><i class="h-2.5 w-2.5 rounded-full bg-[#a55bd8]" />高中</span>
      <span v-if="targetIds?.size" class="flex items-center gap-1"><i class="h-2.5 w-2.5 rounded-full border-2 border-orange-500 bg-white" />目标</span>
      <span v-if="rootIds?.size" class="flex items-center gap-1"><i class="h-2.5 w-2.5 rounded-full bg-red-600" />薄弱根因</span>
      <span class="flex items-center gap-1"><i class="h-px w-4 bg-slate-500" />硬先修</span>
      <span class="flex items-center gap-1"><i class="h-px w-4 border-t border-dashed border-slate-400" />软先修</span>
      <span v-if="hasIndirectEdges" class="flex items-center gap-1"><i class="h-px w-4 border-t border-dotted border-slate-500" />省略关系</span>
    </div>
  </section>
</template>
