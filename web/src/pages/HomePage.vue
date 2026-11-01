<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ErrorState from '@/components/base/ErrorState.vue'
import LoadingState from '@/components/base/LoadingState.vue'
import { normalizeSubject } from '@/data/subjectRegistry'
import { useSubjectStore } from '@/stores/subject'
import { useGraphDataStore } from '@/stores/graphData'
import { loadStats, type GlobalStats } from '@/data/dataClient'
import type { SubjectCode } from '@/data/types'

const route = useRoute()
const router = useRouter()
const subjectStore = useSubjectStore()
const graphStore = useGraphDataStore()
const loadToken = ref(0)

const subject = computed<SubjectCode>(() => normalizeSubject(route.query.subject))
const topics = computed(() => graphStore.topicsFor(subject.value))
const edges = computed(() => graphStore.edgesFor(subject.value))
const globalStats = ref<GlobalStats | null>(null)
const questionCount = computed(() => globalStats.value?.subjects[subject.value]?.questions ?? 0)
const standards = computed(() => graphStore.standardsFor(subject.value))

const gradeGroups = computed(() => {
  const groups = new Map<number, { grade: number; count: number }>()
  for (const topic of topics.value) {
    const current = groups.get(topic.grade) ?? { grade: topic.grade, count: 0 }
    current.count += 1
    groups.set(topic.grade, current)
  }
  return [...groups.values()].sort((a, b) => a.grade - b.grade)
})

async function load() {
  loadToken.value += 1
  try {
    const [stats] = await Promise.all([
      loadStats(),
      graphStore.load(subject.value),
    ])
    globalStats.value = stats
  } catch {
    // Error is rendered from graphStore.state.
  }
}

function switchSubject(code: SubjectCode) {
  void router.push({ path: '/', query: { subject: code } })
}

watch(subject, (value) => subjectStore.setSubject(value), { immediate: true })
onMounted(load)
</script>

<template>
  <div class="space-y-8">
    <section class="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
      <div class="grid gap-8 p-7 lg:grid-cols-[1.3fr_.7fr] lg:p-10">
        <div>
          <p class="mb-3 text-sm font-medium text-teal-700">静态数据 · Vue 3 + TypeScript 展示层</p>
          <h1 class="max-w-3xl text-3xl font-bold tracking-tight text-slate-950 lg:text-5xl">
            先找到真正没有学会的那一步
          </h1>
          <p class="mt-5 max-w-3xl text-base leading-8 text-slate-600">
            沿知识点先修关系浏览课程结构，并在后续迁移中接入原有自适应诊断引擎。当前新版直接读取仓库中的正式 JSON 数据，Python 构建脚本和知识图谱生产流程保持不变。
          </p>
          <div class="mt-7 flex flex-wrap gap-3">
            <RouterLink
              :to="{ path: '/explore/', query: { subject } }"
              class="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"
            >
              浏览知识图谱
            </RouterLink>
            <RouterLink
              :to="{ path: '/diagnose/', query: { subject } }"
              class="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              进入诊断
            </RouterLink>
          </div>
        </div>
        <div class="rounded-2xl bg-teal-50 p-6">
          <p class="text-sm font-semibold text-teal-900">三步定位</p>
          <ol class="mt-4 space-y-4 text-sm leading-6 text-teal-950">
            <li><b>1. 选择知识点</b><br />按学科、年级、章节检索。</li>
            <li><b>2. 自适应答题</b><br />答错后沿先修关系继续确认。</li>
            <li><b>3. 得到学习路径</b><br />定位薄弱根因并按顺序补学。</li>
          </ol>
        </div>
      </div>
    </section>

    <LoadingState v-if="graphStore.state === 'loading'" />
    <ErrorState v-else-if="graphStore.state === 'error'" :message="graphStore.errorMessage" @retry="load" />

    <template v-else-if="graphStore.state === 'success'">
      <section class="flex flex-wrap gap-2">
        <button
          v-for="item in subjectStore.subjects"
          :key="item.code"
          class="rounded-full px-4 py-2 text-sm font-medium transition"
          :class="item.code === subject ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'"
          @click="switchSubject(item.code)"
        >
          {{ item.label }}
        </button>
      </section>

      <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div class="text-3xl font-bold text-slate-950">{{ topics.length }}</div>
          <div class="mt-1 text-sm text-slate-500">知识点</div>
        </div>
        <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div class="text-3xl font-bold text-slate-950">{{ edges.length }}</div>
          <div class="mt-1 text-sm text-slate-500">学科内先修边</div>
        </div>
        <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div class="text-3xl font-bold text-slate-950">{{ questionCount }}</div>
          <div class="mt-1 text-sm text-slate-500">题目</div>
        </div>
        <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div class="text-3xl font-bold text-slate-950">{{ standards.length }}</div>
          <div class="mt-1 text-sm text-slate-500">关联课标条目</div>
        </div>
      </section>

      <section>
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-xl font-bold">按年级进入</h2>
          <RouterLink :to="{ path: '/explore/', query: { subject } }" class="text-sm font-medium text-teal-700">
            查看完整图谱 →
          </RouterLink>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RouterLink
            v-for="group in gradeGroups"
            :key="group.grade"
            :to="{ path: '/explore/', query: { subject, grade: String(group.grade) } }"
            class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div class="text-lg font-semibold">{{ group.grade }} 年级</div>
            <p class="mt-2 text-sm text-slate-500">{{ group.count }} 个知识点</p>
          </RouterLink>
        </div>
      </section>
    </template>
  </div>
</template>
