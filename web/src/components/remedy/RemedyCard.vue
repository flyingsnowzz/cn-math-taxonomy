<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import BaseBadge from '@/components/base/BaseBadge.vue'
import TopicVideoEntry from '@/components/remedy/TopicVideoEntry.vue'
import type { RemedyCardView } from '@/stores/remediation'
import type { RemedyCardState } from '@/engine/remediationAdapter'

const props = defineProps<{ view: RemedyCardView }>()

const stateMeta: Record<RemedyCardState, { label: string; badgeColor: string }> = {
  locked: { label: '未解锁', badgeColor: 'color:#94a3b8' },
  practice: { label: '待练习', badgeColor: 'color:#0f766e' },
  help: { label: '错题待巩固', badgeColor: 'color:#b45309' },
  shortfall: { label: '题目补充中', badgeColor: 'color:#b45309' },
  retest: { label: '待复测', badgeColor: 'color:#2563eb' },
  mastered: { label: '已补上', badgeColor: 'color:#15803d' },
}

const meta = computed(() => stateMeta[props.view.card.state])

const actionLabel = computed(() => {
  const card = props.view.card
  if (card.state === 'mastered') return ''
  if (card.state === 'locked') return ''
  if (card.state === 'help') return '查看解析，继续'
  if (card.state === 'shortfall') return '继续'
  if (card.state === 'retest') return '去复测'
  return card.cursor > 0 || card.wrongs > 0 ? '继续练习' : '开始练习'
})
</script>

<template>
  <li
    class="flex items-center gap-3 rounded-2xl border p-4 transition"
    :class="view.card.unlocked
      ? 'border-slate-200 bg-white shadow-sm'
      : 'border-slate-100 bg-slate-50 opacity-70'"
    data-test="remedy-card"
  >
    <span
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
      :class="view.card.state === 'mastered'
        ? 'bg-emerald-100 text-emerald-700'
        : view.card.unlocked ? 'bg-teal-50 text-teal-800' : 'bg-slate-200 text-slate-500'"
    >
      <span v-if="view.card.state === 'mastered'">✓</span>
      <span v-else>{{ view.card.order + 1 }}</span>
    </span>

    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <p class="truncate font-semibold" data-test="remedy-card-name">
          {{ view.topic?.name ?? view.card.topicId }}
        </p>
        <BaseBadge v-if="view.card.isRoot" color="#dc2626">根因</BaseBadge>
        <BaseBadge v-if="view.card.isTarget" color="#0f766e">目标</BaseBadge>
        <BaseBadge :color="meta.badgeColor">{{ meta.label }}</BaseBadge>
      </div>
      <p v-if="view.topic?.chapter" class="mt-0.5 truncate text-xs text-slate-500">
        {{ view.topic.chapter }}
      </p>
      <p v-if="view.card.state === 'help'" class="mt-1 text-xs text-amber-700">
        有错题，先看解析再继续后面的练习。
      </p>
      <TopicVideoEntry v-if="view.card.state !== 'mastered'" :topic-id="view.card.topicId" variant="card" />
      <p v-if="view.card.state === 'shortfall'" class="mt-1 text-xs text-amber-700">
        该知识点题库练习即将补充，可以先用已有题目继续。
      </p>
    </div>

    <RouterLink
      v-if="actionLabel"
      :to="`/remedy/practice/${view.card.topicId}`"
      class="shrink-0 rounded-xl bg-teal-700 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-teal-800"
      data-test="remedy-card-action"
    >
      {{ actionLabel }}
    </RouterLink>
  </li>
</template>
