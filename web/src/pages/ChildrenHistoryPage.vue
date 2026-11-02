<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useChildrenStore } from '@/stores/children'
import { useBlindspotsStore } from '@/stores/blindspots'
import { loadSubjectDataset } from '@/data/dataClient'
import { isSubjectCode, subjectFromTopicId } from '@/data/subjectRegistry'
import type { SubjectCode } from '@/data/types'

const route = useRoute()
const router = useRouter()
const childrenStore = useChildrenStore()
const blindspotsStore = useBlindspotsStore()
const selectedChildId = ref(String(route.query.child ?? childrenStore.currentId ?? childrenStore.children[0]?.id ?? ''))
const subject = ref(String(route.query.subject ?? ''))
const historyVersion = ref(0)

watch([selectedChildId, subject], ([child, nextSubject]) => {
  void router.replace({
    query: {
      ...(child ? { child: String(child) } : {}),
      ...(nextSubject ? { subject: String(nextSubject) } : {}),
    },
  })
})

watch(
  () => route.query.child,
  (child) => {
    const nextChild = String(child ?? '')
    if (nextChild && nextChild !== selectedChildId.value) selectedChildId.value = nextChild
  },
)

watch(
  () => route.query.subject,
  (nextSubject) => {
    subject.value = String(nextSubject ?? '')
  },
)

const subjects = [
  { code: '', label: '全部学科' },
  { code: 'math', label: '数学' },
  { code: 'english', label: '英语' },
  { code: 'physics', label: '物理' },
  { code: 'chinese', label: '语文' },
  { code: 'science', label: '科学' },
  { code: 'morality', label: '道德与法治' },
  { code: 'history', label: '历史' },
  { code: 'geography', label: '地理' },
]

const records = computed(() => {
  void historyVersion.value
  if (!selectedChildId.value) return []
  return childrenStore
    .recordsOf(selectedChildId.value)
    .filter((record) => !subject.value || record.subject === subject.value)
})

const topicNames = ref<Record<string, string>>({})
const topicDetails = ref<Record<string, { grade: number; chapter: string }>>({})
const historyVersionState = historyVersion

const localBlindRows = computed(() => {
  const code = subject.value && isSubjectCode(subject.value) ? subject.value : null
  return blindspotsStore.list(code).map((row) => ({
    id: row.id,
    status: row.status,
    root: row.root,
    at: row.at,
    label: row.label,
    subject: row.subject,
  }))
})

const latestWeakRows = computed(() => {
  if (!selectedChildId.value) return localBlindRows.value
  const statuses = childrenStore.latestStatus(selectedChildId.value, subject.value || undefined)
  const childRows = Object.entries(statuses)
    .map(([id, status]) => ({ id, ...status }))
    .filter((row) => row.status === 'weak' || row.status === 'shaky')

  // Old page fell back to the machine-wide blind ledger when the selected child had no conclusion.
  const rows = childRows.length > 0 ? childRows : localBlindRows.value
  const gradeOf = (id: string) => topicDetails.value[id]?.grade ?? 99
  return [...rows].sort((a, b) => {
    const rootRankA = a.status === 'weak' ? (a.root ? 0 : 1) : 2
    const rootRankB = b.status === 'weak' ? (b.root ? 0 : 1) : 2
    return rootRankA - rootRankB
      || gradeOf(a.id) - gradeOf(b.id)
      || b.at.localeCompare(a.at)
  })
})

const topicChapter = ref(new Map<string, string>())

const latestWeakIds = computed(() => latestWeakRows.value.map((row) => row.id))
const weakRetestSubject = computed(() => {
  const subjects = [...new Set(latestWeakRows.value.map((row) => row.subject))]
  return subjects.length === 1 && isSubjectCode(subjects[0]) ? subjects[0] : ''
})
const weakCount = computed(() => latestWeakRows.value.filter((row) => row.status === 'weak').length)
const shakyCount = computed(() => latestWeakRows.value.length - weakCount.value)

const latestWeakGroups = computed(() => {
  const groups = new Map<string, typeof latestWeakRows.value>()
  for (const row of latestWeakRows.value) {
    const chapter = topicChapter.value.get(row.id) || '未标注章节'
    const list = groups.get(chapter) ?? []
    list.push(row)
    groups.set(chapter, list)
  }
  return [...groups.entries()].map(([chapter, rows]) => {
    const weakRows = rows.filter((row) => row.status === 'weak')
    const subject = rows[0]?.subject ?? ''
    return {
      chapter,
      rows,
      weakRows,
      retestIds: weakRows.length > 0 ? weakRows.map((row) => row.id) : rows.map((row) => row.id),
      subject,
    }
  })
})

async function refreshTopicNames() {
  const ids = new Set<string>([
    ...records.value.flatMap((record) => [...record.weak, ...record.shaky, ...record.roots]),
    ...latestWeakRows.value.map((row) => row.id),
    ...localBlindRows.value.map((row) => row.id),
  ])
  const neededBySubject = new Map<SubjectCode, Set<string>>()
  for (const id of ids) {
    const recordSubject = records.value.find((record) => record.weak.includes(id) || record.shaky.includes(id) || record.roots.includes(id))?.subject
    const inferredSubject = subjectFromTopicId(id)
    const code = isSubjectCode(recordSubject) ? recordSubject : inferredSubject
    if (!code) continue
    if (!neededBySubject.has(code)) neededBySubject.set(code, new Set())
    neededBySubject.get(code)!.add(id)
  }

  const datasets = await Promise.all(
    [...neededBySubject.entries()].map(async ([code]) => [code, await loadSubjectDataset(code)] as const),
  )
  const nextNames: Record<string, string> = {}
  const nextDetails = new Map<string, { grade: number; chapter: string }>()
  for (const [code, dataset] of datasets) {
    const needed = neededBySubject.get(code) ?? new Set<string>()
    for (const topic of dataset.topics) {
      if (needed.has(topic.id)) {
        nextNames[topic.id] = topic.name
        nextDetails.set(topic.id, { grade: topic.grade, chapter: topic.chapter })
      }
    }
  }
  topicNames.value = nextNames
  topicDetails.value = Object.fromEntries(nextDetails.entries())
  topicChapter.value = new Map([...nextDetails.entries()].map(([id, detail]) => [id, detail.chapter]))
  void historyVersionState.value
}

function nameOf(id: string): string {
  return topicNames.value[id] ?? id
}

watch([records, selectedChildId, subject], () => {
  void refreshTopicNames()
}, { immediate: true })

const subjectLabel = new Map(subjects.map((item) => [item.code, item.label]))

function removeRecord(key: string) {
  if (!selectedChildId.value) return
  childrenStore.removeRecord(selectedChildId.value, key)
  historyVersion.value += 1
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">诊断历史（{{ records.length }}）</h1>
      <p class="mt-1 text-sm text-slate-500">按孩子和学科查看本地保存的诊断结果。</p>
    </div>

    <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <template v-if="childrenStore.children.length === 0">
        <div class="py-6 text-center text-sm text-slate-500">
          还没有孩子档案。诊断结果仍会记入本机盲区；添加孩子后还能按人分开保存。
        </div>
        <RouterLink class="mt-3 inline-flex rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800" to="/children/">
          去添加孩子
        </RouterLink>
        <div v-if="localBlindRows.length" class="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h2 class="font-semibold text-amber-950">本机盲区（未建档）</h2>
          <p class="mt-1 text-xs text-amber-800">共 {{ localBlindRows.length }} 个薄弱或不稳知识点，只存在这台浏览器。</p>
          <div class="mt-3 space-y-3">
            <section v-for="group in latestWeakGroups" :key="group.chapter" class="rounded-xl bg-white/75 p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="text-xs font-semibold text-slate-800">{{ group.chapter }}</h3>
                <RouterLink
                  class="rounded bg-amber-700 px-2 py-1 font-medium text-white hover:bg-amber-800"
                  :to="{ path: '/diagnose/', query: { subject: group.subject, target: group.retestIds.join(',') } }"
                >
                  {{ group.weakRows.length ? `再测本章薄弱（${group.weakRows.length}）` : `再测本章（${group.rows.length}）` }}
                </RouterLink>
              </div>
              <div class="mt-2 flex flex-wrap gap-2">
                <RouterLink
                  v-for="row in group.rows"
                  :key="row.id"
                  class="rounded-full bg-white px-2.5 py-1 ring-1"
                  :class="row.status === 'weak' ? 'text-red-700 ring-red-200' : 'text-amber-700 ring-amber-200'"
                  :to="{ path: '/explore/', query: { subject: row.subject }, hash: `#${encodeURIComponent(row.id)}` }"
                >
                  {{ nameOf(row.id) }} · {{ row.status === 'weak' ? (row.root ? '根因' : '薄弱') : '不稳' }}
                </RouterLink>
              </div>
            </section>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="flex flex-wrap gap-3">
          <label class="text-sm">
            <span class="mr-2 font-medium">孩子</span>
            <select v-model="selectedChildId" class="rounded-xl border border-slate-200 px-3 py-2">
              <option v-for="child in childrenStore.children" :key="child.id" :value="child.id">{{ child.name }}</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="mr-2 font-medium">学科</span>
            <select v-model="subject" class="rounded-xl border border-slate-200 px-3 py-2">
              <option v-for="item in subjects" :key="item.code" :value="item.code">{{ item.label }}</option>
            </select>
          </label>
        </div>

        <div v-if="latestWeakRows.length" class="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="font-semibold text-amber-950">当前仍需关注</h2>
              <p class="mt-1 text-xs text-amber-800">同一个知识点测过好几次，以最近一次为准。薄弱 {{ weakCount }} 个，不稳 {{ shakyCount }} 个。</p>
            </div>
            <RouterLink
              v-if="weakRetestSubject"
              class="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
              :to="{ path: '/diagnose/', query: { subject: weakRetestSubject, target: latestWeakIds.join(',') } }"
            >
              再测薄弱点
            </RouterLink>
          </div>
          <div class="mt-3 space-y-3">
            <section v-for="group in latestWeakGroups" :key="group.chapter" class="rounded-xl bg-white/75 p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="text-xs font-semibold text-slate-800">{{ group.chapter }}</h3>
                <RouterLink
                  class="rounded bg-amber-700 px-2 py-1 font-medium text-white hover:bg-amber-800"
                  :to="{ path: '/diagnose/', query: { subject: group.subject, target: group.retestIds.join(',') } }"
                >
                  {{ group.weakRows.length ? `再测本章薄弱（${group.weakRows.length}）` : `再测本章（${group.rows.length}）` }}
                </RouterLink>
              </div>
              <div class="mt-2 flex flex-wrap gap-2">
                <RouterLink
                  v-for="row in group.rows"
                  :key="row.id"
                  class="rounded-full bg-white px-2.5 py-1 ring-1"
                  :class="row.status === 'weak' ? 'text-red-700 ring-red-200' : 'text-amber-700 ring-amber-200'"
                  :to="{ path: '/explore/', query: { subject: row.subject }, hash: `#${encodeURIComponent(row.id)}` }"
                >
                  {{ nameOf(row.id) }} · {{ row.status === 'weak' ? (row.root ? '根因' : '薄弱') : '不稳' }}
                </RouterLink>
              </div>
            </section>
          </div>
        </div>

        <div class="mt-6 grid gap-3">
          <article v-for="record in records" :key="record.key" class="rounded-2xl border border-slate-200 p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="font-semibold">{{ record.label }}</h2>
                <p class="mt-1 text-xs text-slate-500">
                  {{ subjectLabel.get(record.subject) ?? record.subject }} · {{ record.mode === 'screen' ? '整体筛查' : '目标诊断' }} ·
                  {{ new Date(record.updatedAt ?? record.savedAt).toLocaleString() }}
                </p>
              </div>
              <div class="flex gap-2 text-xs">
                <span class="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">掌握 {{ record.mastered.length }}</span>
                <span class="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">不稳 {{ record.shaky.length }}</span>
                <span class="rounded-full bg-red-50 px-2.5 py-1 text-red-800">薄弱 {{ record.weak.length }}</span>
                <span v-if="record.counts?.untested" class="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">未测 {{ record.counts.untested }}</span>
              </div>
            </div>
            <p class="mt-2 text-xs text-slate-500">共答 {{ record.asked ?? 0 }} 题{{ record.mode === 'screen' ? '，整体筛查' : '' }}。</p>
            <div v-if="record.weak.length || record.shaky.length || record.roots.length" class="mt-3 space-y-2 text-sm">
              <div v-if="record.weak.length" class="flex flex-wrap items-center gap-2">
                <span class="shrink-0 text-xs font-semibold text-red-700">薄弱</span>
                <RouterLink
                  v-for="id in record.weak"
                  :key="`weak-${id}`"
                  class="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700 hover:bg-red-100"
                  :to="{ path: '/explore/', query: { subject: record.subject }, hash: `#${encodeURIComponent(id)}` }"
                >
                  {{ nameOf(id) }}<span v-if="record.roots.includes(id)" class="ml-1">根因</span>
                </RouterLink>
              </div>
              <div v-if="record.shaky.length" class="flex flex-wrap items-center gap-2">
                <span class="shrink-0 text-xs font-semibold text-amber-700">不稳</span>
                <RouterLink
                  v-for="id in record.shaky"
                  :key="`shaky-${id}`"
                  class="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-100"
                  :to="{ path: '/explore/', query: { subject: record.subject }, hash: `#${encodeURIComponent(id)}` }"
                >
                  {{ nameOf(id) }}
                </RouterLink>
              </div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <RouterLink
                v-if="record.targets?.length"
                class="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                :to="{ path: '/diagnose/', query: { subject: record.subject, target: record.targets.join(',') } }"
              >
                再测一次
              </RouterLink>
              <button
                class="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                @click="removeRecord(record.key)"
              >
                删除记录
              </button>
            </div>
          </article>
          <div v-if="records.length === 0" class="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            当前筛选条件下暂无历史记录。
          </div>
          <div class="mt-5">
            <RouterLink
              class="inline-flex rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              :to="{ path: '/diagnose/', query: subject ? { subject } : {} }"
            >
              去做一次诊断
            </RouterLink>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>
