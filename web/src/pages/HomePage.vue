<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ErrorState from '@/components/base/ErrorState.vue'
import LoadingState from '@/components/base/LoadingState.vue'
import { formatGradeForSubject as getSubjectGradeLabel, normalizeSubject } from '@/data/subjectRegistry'
import { useSubjectStore } from '@/stores/subject'
import { useGraphDataStore } from '@/stores/graphData'
import { useBlindspotsStore } from '@/stores/blindspots'
import { loadStats, type GlobalStats } from '@/data/dataClient'
import type { SubjectCode } from '@/data/types'

const route = useRoute()
const router = useRouter()
const subjectStore = useSubjectStore()
const graphStore = useGraphDataStore()
const blindspotsStore = useBlindspotsStore()
const loadToken = ref(0)

const subject = computed<SubjectCode>(() => normalizeSubject(route.query.subject))

const subjectCopy: Record<SubjectCode, { coverage: string; sampleTopic: string }> = {
  math: { coverage: '数学：小学到高中；英语：三年级到高中；物理：初中到高中；语文、科学、道德与法治覆盖小学；历史、地理覆盖初中。', sampleTopic: '配方法' },
  english: { coverage: '英语覆盖三年级到高中，包含小学、初中、高中必修和选择性必修内容。', sampleTopic: '现在进行时' },
  physics: { coverage: '物理覆盖初中八、九年级，以及高中必修和选择性必修内容。', sampleTopic: '欧姆定律' },
  chinese: { coverage: '语文覆盖统编版小学一至六年级。', sampleTopic: '静夜思' },
  science: { coverage: '科学覆盖教科版小学一至六年级。', sampleTopic: '昼夜交替' },
  morality: { coverage: '道德与法治覆盖统编版小学一至六年级。', sampleTopic: '国旗' },
  history: { coverage: '历史覆盖统编版初中七至九年级。', sampleTopic: '远古时期的人类活动' },
  geography: { coverage: '地理覆盖人教版初中七至八年级。', sampleTopic: '地球的宇宙环境' },
}

const topics = computed(() => graphStore.topicsFor(subject.value))
const edges = computed(() => graphStore.edgesFor(subject.value))
const globalStats = ref<GlobalStats | null>(null)
const questionCount = computed(() => globalStats.value?.subjects[subject.value]?.questions ?? 0)
const standards = computed(() => graphStore.standardsFor(subject.value))

const demoTarget = computed(() =>
  topics.value.find((topic) => topic.name.includes(subjectCopy[subject.value].sampleTopic))?.id
  ?? topics.value[0]?.id
  ?? '',
)
const blindRows = computed(() => blindspotsStore.list(subject.value, 5))

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
watch(subject, (value, previousValue) => {
  if (previousValue && value !== previousValue) void load()
})
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
            {{ subjectCopy[subject].coverage }} 沿知识点先修关系浏览课程结构，并使用原有确定性诊断引擎进行自适应诊断。新版读取构建生成的静态学科数据包，Python 构建脚本和知识图谱生产流程保持不变。
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
            <RouterLink
              v-if="demoTarget"
              :to="{ path: '/diagnose/', query: { subject, target: demoTarget, demo: '1' } }"
              class="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              先看一遍演示：{{ subjectCopy[subject].sampleTopic }}
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
          <div class="text-3xl font-bold text-slate-950" data-testid="home-topic-count">{{ topics.length }}</div>
          <div class="mt-1 text-sm text-slate-500">知识点</div>
        </div>
        <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div class="text-3xl font-bold text-slate-950">{{ edges.length }}</div>
          <div class="mt-1 text-sm text-slate-500">学科内先修边</div>
        </div>
        <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div class="text-3xl font-bold text-slate-950" data-testid="home-question-count">{{ questionCount }}</div>
          <div class="mt-1 text-sm text-slate-500">题目</div>
        </div>
        <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div class="text-3xl font-bold text-slate-950">{{ standards.length }}</div>
          <div class="mt-1 text-sm text-slate-500">关联课标条目</div>
        </div>
      </section>


      <section v-if="blindRows.length" class="rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-bold text-amber-950">本机薄弱点</h2>
            <p class="mt-1 text-sm text-amber-800">来自未完成会话、诊断结果和当前孩子档案，不会上传。</p>
          </div>
          <RouterLink
            :to="blindspotsStore.diagnoseHref(blindRows.slice(0, 8).map((row) => row.id), subject)"
            class="rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
          >
            一键再测
          </RouterLink>
        </div>
        <div class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <RouterLink
            v-for="row in blindRows"
            :key="row.id"
            :to="blindspotsStore.diagnoseHref([row.id], subject)"
            class="rounded-2xl bg-white/80 p-3 text-sm shadow-sm ring-1 ring-amber-100 transition hover:bg-white"
          >
            <span class="font-semibold text-slate-900">{{ row.label || row.id }}</span>
            <span class="mt-1 block text-xs" :class="row.status === 'weak' ? 'text-red-700' : 'text-amber-700'">
              {{ row.status === 'weak' ? '薄弱' : '不稳' }} · {{ row.source === 'child' ? '孩子档案' : row.source === 'session' ? '未完成会话' : '本机账本' }}
            </span>
          </RouterLink>
        </div>
      </section>

      <section>
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-xl font-bold">按年级 / 册次进入</h2>
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
            <div class="text-lg font-semibold">{{ getSubjectGradeLabel(subject, group.grade) }}</div>
            <p class="mt-2 text-sm text-slate-500">{{ group.count }} 个知识点</p>
          </RouterLink>
        </div>
      </section>
    </template>
  </div>
</template>
