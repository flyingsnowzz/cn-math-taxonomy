<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ErrorState from '@/components/base/ErrorState.vue'
import LoadingState from '@/components/base/LoadingState.vue'
import KnowledgeGraph from '@/components/graph/KnowledgeGraph.vue'
import { selectNeighborhood } from '@/components/graph/graphAdapter'
import { getSubject, normalizeSubject } from '@/data/subjectRegistry'
import { standardItems } from '@/data/guards'
import { useGraphDataStore } from '@/stores/graphData'
import { useSubjectStore } from '@/stores/subject'
import type { CurriculumStandardItem, SubjectCode, Topic } from '@/data/types'

const route = useRoute()
const router = useRouter()
const graphStore = useGraphDataStore()
const subjectStore = useSubjectStore()

const searchText = ref(String(route.query.q ?? ''))
const gradeFilter = ref(String(route.query.grade ?? ''))
const domainFilter = ref(String(route.query.domain ?? ''))
const upDepth = ref(2)
const listExpanded = ref(false)

const subject = computed<SubjectCode>(() => normalizeSubject(route.query.subject))
const selectedId = computed(() => decodeURIComponent(String(route.hash ?? '').replace(/^#/, '')))
const topics = computed(() => graphStore.topicsFor(subject.value))
const edges = computed(() => graphStore.edgesFor(subject.value))
const standardsById = computed<Map<string, CurriculumStandardItem>>(() => {
  const ids = new Set(topics.value.flatMap((topic) => (topic.standards ?? []).map((item) => item.id)))
  return new Map(
    standardItems(graphStore.dataset?.standards ?? { items: [] })
      .filter((item) => ids.has(item.id))
      .map((item) => [item.id, item]),
  )
})

const gradeOptions = computed(() => [...new Set(topics.value.map((topic) => topic.grade))].sort((a, b) => a - b))
const domainOptions = computed(() => [...new Set(topics.value.map((topic) => topic.domain))].sort())

const filteredTopics = computed(() => {
  const query = searchText.value.trim().toLowerCase()
  return topics.value
    .filter((topic) => {
      if (gradeFilter.value && String(topic.grade) !== gradeFilter.value) return false
      if (domainFilter.value && topic.domain !== domainFilter.value) return false
      if (!query) return true
      const haystack = `${topic.id} ${topic.name} ${topic.chapter} ${topic.domain}`.toLowerCase()
      return haystack.includes(query)
    })
    .sort((a, b) => a.chapter.localeCompare(b.chapter, 'zh-Hans-CN') || a.id.localeCompare(b.id))
})

const visibleTopics = computed(() => (listExpanded.value ? filteredTopics.value : filteredTopics.value.slice(0, 120)))
const selectedTopic = computed<Topic | undefined>(() => topics.value.find((topic) => topic.id === selectedId.value))
const selectedStandards = computed(() =>
  selectedTopic.value
    ? (selectedTopic.value.standards ?? [])
        .map((ref) => ({ ref, item: standardsById.value.get(ref.id) }))
        .filter((entry) => entry.item)
    : [],
)

const neighborhood = computed(() =>
  selectedTopic.value
    ? selectNeighborhood(topics.value, edges.value, selectedTopic.value.id, {
        upDepth: upDepth.value,
        downDepth: 1,
      })
    : { topics: [], edges: [] },
)

async function load() {
  try {
    await graphStore.load(subject.value)
  } catch {
    // Error state is rendered from graphStore.
  }
}

async function selectTopic(id: string) {
  await router.replace({
    path: '/explore/',
    query: { ...route.query, subject: subject.value },
    hash: `#${encodeURIComponent(id)}`,
  })
}

watch(subject, (value) => subjectStore.setSubject(value), { immediate: true })
watch(
  () => [graphStore.state, selectedId.value, topics.value.length] as const,
  ([state, id, count]) => {
    if (state !== 'success' || count === 0) return
    if (!id || !topics.value.some((topic) => topic.id === id)) {
      const first = filteredTopics.value[0] ?? topics.value[0]
      if (first) void selectTopic(first.id)
    }
  },
  { immediate: true },
)

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <LoadingState v-if="graphStore.state === 'loading'" />
    <ErrorState v-else-if="graphStore.state === 'error'" :message="graphStore.errorMessage" @retry="load" />

    <template v-else-if="graphStore.state === 'success'">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">{{ getSubject(subject).label }}知识图谱</h1>
          <p class="mt-1 text-sm text-slate-500">点选一个知识点，查看它从哪些先修内容长出来。</p>
        </div>
        <div class="flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
          <button
            v-for="item in subjectStore.subjects"
            :key="item.code"
            class="rounded-lg px-3 py-1.5 text-xs font-medium"
            :class="item.code === subject ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-100'"
            @click="router.replace({ path: '/explore/', query: { subject: item.code } })"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)_360px]">
        <aside class="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <input
            v-model="searchText"
            type="search"
            placeholder="搜索名称、章节或编号"
            class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
          <div class="grid grid-cols-2 gap-2">
            <select v-model="gradeFilter" class="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">全部年级</option>
              <option v-for="grade in gradeOptions" :key="grade" :value="String(grade)">{{ grade }} 年级</option>
            </select>
            <select v-model="domainFilter" class="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">全部领域</option>
              <option v-for="domain in domainOptions" :key="domain" :value="domain">{{ domain }}</option>
            </select>
          </div>

          <div class="flex items-center justify-between text-xs text-slate-500">
            <span>{{ filteredTopics.length }} 个知识点</span>
            <div class="flex gap-1">
              <button
                v-for="depth in [1, 2, 3, 99]"
                :key="depth"
                class="rounded-full px-2.5 py-1"
                :class="upDepth === depth ? 'bg-teal-700 text-white' : 'bg-slate-100 hover:bg-slate-200'"
                @click="upDepth = depth"
              >
                {{ depth === 99 ? '全部祖先' : `向上 ${depth} 层` }}
              </button>
            </div>
          </div>

          <div class="max-h-[calc(100vh-260px)] space-y-1 overflow-y-auto pr-1">
            <button
              v-for="topic in visibleTopics"
              :key="topic.id"
              class="w-full rounded-xl px-3 py-2 text-left transition"
              :class="topic.id === selectedId ? 'bg-teal-50 ring-1 ring-teal-200' : 'hover:bg-slate-50'"
              @click="selectTopic(topic.id)"
            >
              <span class="block text-sm font-semibold text-slate-800">{{ topic.name }}</span>
              <span class="mt-0.5 block truncate text-xs text-slate-500">{{ topic.chapter }}</span>
            </button>
            <button
              v-if="filteredTopics.length > visibleTopics.length"
              class="w-full rounded-xl py-2 text-sm font-medium text-teal-700 hover:bg-teal-50"
              @click="listExpanded = true"
            >
              展开剩余 {{ filteredTopics.length - visibleTopics.length }} 个
            </button>
          </div>
        </aside>

        <KnowledgeGraph
          :topics="neighborhood.topics"
          :edges="neighborhood.edges"
          :selected-id="selectedId"
          :subject="subject"
          class="min-h-[640px]"
          @select="selectTopic"
        />

        <aside class="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <template v-if="selectedTopic">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="rounded-full px-2.5 py-1 text-xs font-semibold"
                  :style="{ backgroundColor: `${getSubject(subject).graphColor}18`, color: getSubject(subject).graphColor }"
                >
                  {{ getSubject(subject).label }}
                </span>
                <span class="text-xs text-slate-400">{{ selectedTopic.id }}</span>
              </div>
              <h2 class="mt-3 text-2xl font-bold">{{ selectedTopic.name }}</h2>
              <RouterLink
                :to="{ path: '/diagnose/', query: { subject, target: selectedTopic.id } }"
                class="mt-4 inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
              >
                诊断这个知识点
              </RouterLink>
            </div>

            <dl class="grid grid-cols-2 gap-3 text-sm">
              <div class="rounded-xl bg-slate-50 p-3">
                <dt class="text-xs text-slate-500">年级</dt>
                <dd class="mt-1 font-semibold">{{ selectedTopic.grade }}</dd>
              </div>
              <div class="rounded-xl bg-slate-50 p-3">
                <dt class="text-xs text-slate-500">领域</dt>
                <dd class="mt-1 font-semibold">{{ selectedTopic.domain }}</dd>
              </div>
            </dl>

            <div>
              <h3 class="mb-1 text-sm font-semibold">章节</h3>
              <p class="text-sm leading-6 text-slate-600">{{ selectedTopic.chapter }}</p>
            </div>
            <div v-if="selectedTopic.description">
              <h3 class="mb-1 text-sm font-semibold">说明</h3>
              <p class="text-sm leading-6 text-slate-600">{{ selectedTopic.description }}</p>
            </div>
            <div v-if="selectedTopic.mastery_criteria?.length">
              <h3 class="mb-2 text-sm font-semibold">掌握标准</h3>
              <ul class="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
                <li v-for="criterion in selectedTopic.mastery_criteria" :key="criterion">{{ criterion }}</li>
              </ul>
            </div>
            <div v-if="selectedStandards.length">
              <h3 class="mb-2 text-sm font-semibold">课标条目</h3>
              <div v-for="entry in selectedStandards" :key="entry.ref.id" class="mb-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                <b>{{ entry.ref.id }}</b> · {{ entry.ref.confidence === 'exact' ? '直接对应' : '推断映射' }}
                <p v-if="entry.item?.text" class="mt-1">{{ entry.item.text }}</p>
              </div>
            </div>
            <div v-if="selectedTopic.diagnostic_question">
              <h3 class="mb-2 text-sm font-semibold">样题</h3>
              <p class="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                {{ selectedTopic.diagnostic_question.question }}
              </p>
            </div>
          </template>
        </aside>
      </div>
    </template>
  </div>
</template>
