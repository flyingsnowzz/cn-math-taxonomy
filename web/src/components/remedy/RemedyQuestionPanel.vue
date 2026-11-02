<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseButton from '@/components/base/BaseButton.vue'
import QuestionFigure from '@/components/QuestionFigure.vue'
import type { AnswerResult } from '@/engine/engineAdapter'
import type { Question } from '@/data/types'

const props = defineProps<{ question: Question }>()
const emit = defineEmits<{
  judge: [text: string]
  selfResult: [result: AnswerResult]
}>()

const selected = ref('')
const text = ref('')

watch(
  () => props.question.id,
  () => {
    selected.value = ''
    text.value = ''
  },
)

const isChoice = computed(() => props.question.type === 'choice')
const isSelfReport = computed(() => props.question.type === 'short' || props.question.type === 'self')

function submitChoice() {
  if (selected.value) emit('judge', selected.value)
}
function submitText() {
  if (text.value.trim()) emit('judge', text.value.trim())
}
</script>

<template>
  <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
    <p class="text-[15px] leading-7">{{ question.prompt }}</p>
    <QuestionFigure v-if="question.figure" :svg="question.figure" />

    <div v-if="isChoice" class="mt-4 space-y-2" data-test="remedy-choices">
      <button
        v-for="choice in question.choices ?? []"
        :key="choice.key"
        type="button"
        class="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition"
        :class="selected === choice.key
          ? 'border-teal-600 bg-teal-50 text-teal-900'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'"
        @click="selected = choice.key"
      >
        <span
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
          :class="selected === choice.key ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300'"
        >{{ choice.key }}</span>
        <span>{{ choice.text }}</span>
      </button>
      <BaseButton variant="primary" :disabled="!selected" class="mt-2" @click="submitChoice">
        提交
      </BaseButton>
    </div>

    <form v-else-if="!isSelfReport" class="mt-4 flex gap-2" @submit.prevent="submitText">
      <input
        v-model="text"
        type="text"
        inputmode="text"
        autocomplete="off"
        placeholder="输入你的答案"
        class="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
        data-test="remedy-text-input"
      >
      <BaseButton variant="primary" :disabled="!text.trim()" type="submit">提交</BaseButton>
    </form>

    <div v-else class="mt-4 flex gap-2" data-test="remedy-self-report">
      <BaseButton variant="primary" @click="emit('selfResult', 'correct')">我答对了</BaseButton>
      <BaseButton @click="emit('selfResult', 'skip')">不会，看解析</BaseButton>
    </div>
  </div>
</template>
