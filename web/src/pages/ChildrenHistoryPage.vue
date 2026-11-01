<script setup lang="ts">
import { computed, ref } from 'vue'
import { useChildrenStore } from '@/stores/children'

const childrenStore = useChildrenStore()
const selectedChildId = ref(childrenStore.currentId ?? childrenStore.children[0]?.id ?? '')
const subject = ref('')

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
  if (!selectedChildId.value) return []
  return childrenStore
    .recordsOf(selectedChildId.value)
    .filter((record) => !subject.value || record.subject === subject.value)
})

const subjectLabel = new Map(subjects.map((item) => [item.code, item.label]))
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">诊断历史</h1>
      <p class="mt-1 text-sm text-slate-500">按孩子和学科查看本地保存的诊断结果。</p>
    </div>

    <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div v-if="childrenStore.children.length === 0" class="py-10 text-center text-sm text-slate-500">
        还没有孩子档案。
      </div>
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
              </div>
            </div>
            <p v-if="record.roots.length" class="mt-3 text-sm text-slate-600">
              根因：{{ record.roots.join('、') }}
            </p>
          </article>
          <div v-if="records.length === 0" class="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            当前筛选条件下暂无历史记录。
          </div>
        </div>
      </template>
    </section>
  </div>
</template>
