import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getSubject, normalizeSubject, SUBJECTS } from '@/data/subjectRegistry'
import type { SubjectCode } from '@/data/types'

export const useSubjectStore = defineStore('subject', () => {
  const current = ref<SubjectCode>('math')
  const definition = computed(() => getSubject(current.value))

  function setSubject(value: unknown) {
    current.value = normalizeSubject(value)
  }

  return { current, definition, subjects: SUBJECTS, setSubject }
})
