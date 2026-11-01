import { ref } from 'vue'
import { defineStore } from 'pinia'
import { loadSubjectQuestions } from '@/data/dataClient'
import type { Question, SubjectCode } from '@/data/types'

export const useQuestionStore = defineStore('question', () => {
  const questions = ref<Question[]>([])
  const subject = ref<SubjectCode | null>(null)
  const state = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
  const errorMessage = ref('')

  async function load(nextSubject: SubjectCode) {
    if (subject.value === nextSubject && state.value === 'success') return questions.value
    state.value = 'loading'
    try {
      const dataset = await loadSubjectQuestions(nextSubject)
      questions.value = dataset.questions
      subject.value = nextSubject
      state.value = 'success'
      return questions.value
    } catch (error) {
      state.value = 'error'
      errorMessage.value = error instanceof Error ? error.message : '题库加载失败'
      throw error
    }
  }

  function forTopic(topicId: string): Question[] {
    return questions.value.filter((question) => question.topicId === topicId)
  }

  return { questions, subject, state, errorMessage, load, forTopic }
})
