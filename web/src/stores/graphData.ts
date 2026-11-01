import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { loadSubjectDataset } from '@/data/dataClient'
import { subjectOfTopic } from '@/data/subjectRegistry'
import { standardItems } from '@/data/guards'
import type {
  CurriculumStandardItem,
  DependencyEdge,
  GraphDataset,
  SubjectCode,
  Topic,
} from '@/data/types'

type LoadState = 'idle' | 'loading' | 'success' | 'error'

export const useGraphDataStore = defineStore('graph-data', () => {
  const dataset = ref<GraphDataset | null>(null)
  const loadedSubject = ref<SubjectCode | null>(null)
  const state = ref<LoadState>('idle')
  const errorMessage = ref('')
  let requestSerial = 0

  async function load(subject: SubjectCode, signal?: AbortSignal) {
    if (dataset.value && loadedSubject.value === subject) return dataset.value
    const requestId = ++requestSerial
    state.value = 'loading'
    errorMessage.value = ''
    try {
      const nextDataset = await loadSubjectDataset(subject, signal)
      if (requestId !== requestSerial) return dataset.value
      dataset.value = nextDataset
      loadedSubject.value = subject
      state.value = 'success'
      return dataset.value
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      if (requestId === requestSerial) {
        state.value = 'error'
        errorMessage.value = error instanceof Error ? error.message : '数据加载失败'
      }
      throw error
    }
  }

  function topicsFor(subject: SubjectCode): Topic[] {
    if (loadedSubject.value !== subject) return []
    return dataset.value?.topics.filter((topic) => subjectOfTopic(topic) === subject) ?? []
  }

  function edgesFor(subject: SubjectCode): DependencyEdge[] {
    if (loadedSubject.value !== subject) return []
    const allowed = new Set(topicsFor(subject).map((topic) => topic.id))
    return (
      dataset.value?.edges.filter(
        (edge) => allowed.has(edge.topicId) && allowed.has(edge.prerequisiteId),
      ) ?? []
    )
  }

  function standardsFor(subject: SubjectCode): CurriculumStandardItem[] {
    if (loadedSubject.value !== subject) return []
    const topics = topicsFor(subject)
    const ids = new Set(
      topics.flatMap((topic) => (topic.standards ?? []).map((standard) => standard.id)),
    )
    return standardItems(dataset.value?.standards ?? { items: [] }).filter((item) =>
      ids.has(item.id),
    )
  }

  const topicCount = computed(() => dataset.value?.topics.length ?? 0)

  return {
    dataset,
    loadedSubject,
    state,
    errorMessage,
    topicCount,
    load,
    topicsFor,
    edgesFor,
    standardsFor,
  }
})
