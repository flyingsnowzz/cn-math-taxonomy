export interface ChildProfile {
  id: string
  name: string
  grade: string
  textbook: string
  createdAt: string
}

export interface ChildProfilesState {
  v: 1
  current: string | null
  children: ChildProfile[]
  [key: string]: unknown
}

export interface ChildDiagnosticRecord {
  key: string
  subject: 'math' | 'chinese' | 'science' | 'morality' | 'history' | 'geography' | 'english' | 'physics'
  label: string
  mode?: 'target' | 'screen'
  targets: string[] | null
  asked?: number
  counts?: Record<string, number>
  weak: string[]
  shaky: string[]
  mastered: string[]
  roots: string[]
  savedAt: string
  updatedAt?: string
  [key: string]: unknown
}

export type ChildRecords = Record<string, ChildDiagnosticRecord[]>
export type ChildStatus = 'mastered' | 'shaky' | 'weak'
export type ChildRecordsMap = Record<string, ChildDiagnosticRecord[]>

export interface ChildrenBackup {
  format: 'cn-math-taxonomy.children'
  version: 1
  exportedAt: string
  profiles: ChildProfilesState
  records: ChildRecordsMap
}

export interface ImportSummaryChild {
  name: string
  sourceName: string
  action: 'add' | 'merge' | 'rename'
  records: number
}

export interface ImportSummary {
  addedChildren: number
  matchedChildren: number
  renamedChildren: number
  addedRecords: number
  updatedRecords: number
  keptRecords: number
  children: ImportSummaryChild[]
  token: string
}

export interface AddChildResult {
  ok: boolean
  error?: string
  child?: ChildProfile
}

export interface CnmChildrenApi {
  GRADES: string[]
  TEXTBOOKS: string[]
  MAX_CHILDREN: number
  MAX_BACKUP_BYTES: number
  list: () => ChildProfile[]
  get: (id: string) => ChildProfile | null
  current: () => ChildProfile | null
  setCurrent: (id: string | null) => boolean
  add: (form: { name: string; grade: string; textbook: string }) => AddChildResult
  update: (id: string, form: { name: string; grade: string; textbook: string }) => AddChildResult
  remove: (id: string) => void
  recordsOf: (childId: string) => ChildDiagnosticRecord[]
  saveRecord: (childId: string, record: ChildDiagnosticRecord) => boolean
  hasRecord: (childId: string, key: string) => boolean
  moveRecord: (key: string, fromId: string, toId: string) => void
  removeRecord: (childId: string, key: string) => void
  latestStatus: (
    childId: string,
    subject?: string,
  ) => Record<string, { status: ChildStatus; recKey: string; at: string; label: string; root: boolean; subject: string }>
  exportBackup: () => ChildrenBackup
  parseBackup: (text: string) => ChildrenBackup
  previewImport: (backup: ChildrenBackup) => ImportSummary
  importBackup: (backup: ChildrenBackup, token: string) => ImportSummary
}

declare const children: CnmChildrenApi
export default children
