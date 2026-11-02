import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import legacyChildren from '@/children/legacy/children.js'
import type {
  ChildDiagnosticRecord,
  ChildProfile,
  ChildrenBackup,
  ImportSummary,
} from '@/children/legacy/children'

export interface ChildForm {
  name: string
  grade: string
  textbook: string
}

export const useChildrenStore = defineStore('children', () => {
  const children = ref<ChildProfile[]>([])
  const currentId = ref<string | null>(null)
  const importSummary = ref<ImportSummary | null>(null)
  const importToken = ref('')
  const lastError = ref('')

  const current = computed(() => children.value.find((child) => child.id === currentId.value) ?? null)

  function refresh() {
    children.value = legacyChildren.list()
    currentId.value = legacyChildren.current()?.id ?? null
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('cnm:sync-merged', (event) => {
      const keys = (event as CustomEvent<{ keys: string[] }>).detail?.keys ?? []
      if (keys.includes('cnmChildren.v1') || keys.includes('cnmChildren.records.v1')) refresh()
    })
  }

  refresh()

  function setCurrent(id: string | null) {
    if (legacyChildren.setCurrent(id)) refresh()
  }

  function add(form: ChildForm): boolean {
    const result = legacyChildren.add(form)
    lastError.value = result.ok ? '' : (result.error ?? '保存失败')
    if (result.ok) refresh()
    return result.ok
  }

  function update(id: string, form: ChildForm): boolean {
    const result = legacyChildren.update(id, form)
    lastError.value = result.ok ? '' : (result.error ?? '保存失败')
    if (result.ok) refresh()
    return result.ok
  }

  function remove(id: string) {
    legacyChildren.remove(id)
    refresh()
  }

  function removeRecord(id: string, key: string) {
    legacyChildren.removeRecord(id, key)
    refresh()
  }

  function recordsOf(id: string): ChildDiagnosticRecord[] {
    return legacyChildren.recordsOf(id)
  }

  function saveRecord(id: string, record: ChildDiagnosticRecord): boolean {
    return legacyChildren.saveRecord(id, record)
  }

  function latestStatus(id: string, subjectCode?: string) {
    return legacyChildren.latestStatus(id, subjectCode || undefined)
  }

  function exportBackup(): ChildrenBackup {
    return legacyChildren.exportBackup()
  }

  function downloadBackup() {
    const backup = exportBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cn-math-taxonomy-children-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  function parseBackupText(text: string): ChildrenBackup {
    const backup = legacyChildren.parseBackup(text)
    importSummary.value = legacyChildren.previewImport(backup)
    importToken.value = importSummary.value.token
    lastError.value = ''
    return backup
  }

  function confirmImport(backup: ChildrenBackup) {
    legacyChildren.importBackup(backup, importToken.value)
    importSummary.value = null
    importToken.value = ''
    refresh()
  }

  function cancelImport() {
    importSummary.value = null
    importToken.value = ''
  }

  refresh()

  return {
    children,
    currentId,
    current,
    importSummary,
    lastError,
    grades: legacyChildren.GRADES,
    textbooks: legacyChildren.TEXTBOOKS,
    refresh,
    setCurrent,
    add,
    update,
    remove,
    removeRecord,
    recordsOf,
    saveRecord,
    latestStatus,
    exportBackup,
    downloadBackup,
    parseBackupText,
    confirmImport,
    cancelImport,
  }
})
