import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import legacyChildren from '@/children/legacy/children.js'
import { SUBJECTS, subjectFromTopicId } from '@/data/subjectRegistry'
import { readJson, writeJson } from '@/utils/storage'
import type { AnswerResult, EngineSummary } from '@/engine/engineAdapter'
import type { SubjectCode } from '@/data/types'

export interface BlindRow {
  id: string
  subject: SubjectCode
  status: 'weak' | 'shaky'
  root: boolean
  hits: number
  wrongs: number
  at: string
  label: string
  source: 'local' | 'child' | 'session'
}

interface BlindRecord {
  id: string
  subject: SubjectCode
  status: 'mastered' | 'shaky' | 'weak'
  root: boolean
  hits: number
  wrongs: number
  lastAt: string
  lastLabel: string
  lastKey: string
}

interface BlindFile {
  v: 1
  byId: Record<string, BlindRecord>
}

interface SavedSession {
  v: number
  label?: string
  savedAt?: string
  answers: Array<{ id: string; qid?: string | null; result: AnswerResult }>
}

interface NoteResultPayload {
  subject: SubjectCode
  label: string
  key: string
  demo?: boolean
  answers: Array<{ id: string; qid?: string | null; result: AnswerResult }>
  summary: EngineSummary
}

const STORAGE_KEY = 'cnmBlind.local.v1'
const MAX_TOPICS = 200

function isSubject(value: unknown): value is SubjectCode {
  return typeof value === 'string' && SUBJECTS.some((subject) => subject.code === value)
}

function emptyFile(): BlindFile {
  return { v: 1, byId: {} }
}

function readBlindFile(): BlindFile {
  return readJson(STORAGE_KEY, (value: unknown): value is BlindFile => {
    if (typeof value !== 'object' || value === null) return false
    const record = value as Record<string, unknown>
    return record.v === 1 && typeof record.byId === 'object' && record.byId !== null
  }) ?? emptyFile()
}

function tallyWrongs(answers: NoteResultPayload['answers']): Record<string, number> {
  return answers.reduce<Record<string, number>>((acc, answer) => {
    if (answer.result === 'wrong' || answer.result === 'skip') {
      acc[answer.id] = (acc[answer.id] ?? 0) + 1
    }
    return acc
  }, {})
}

function rank(row: BlindRow): number {
  return (row.status === 'weak' ? 0 : 2) + (row.root ? 0 : 1)
}

function sortRows(rows: BlindRow[]): BlindRow[] {
  return rows.sort((a, b) =>
    rank(a) - rank(b) ||
    b.wrongs - a.wrongs ||
    b.hits - a.hits ||
    b.at.localeCompare(a.at),
  )
}

export const useBlindspotsStore = defineStore('blindspots', () => {
  const version = ref(0)

  function refresh() {
    version.value += 1
  }

  function noteResult(payload: NoteResultPayload): boolean {
    if (payload.demo) return false
    const file = readBlindFile()
    const now = new Date().toISOString()
    const wrongs = tallyWrongs(payload.answers)
    const rootIds = new Set(payload.summary.roots.map((root) => root.id))

    const put = (ids: string[], status: BlindRecord['status']) => {
      for (const id of ids) {
        const previous = file.byId[id]
        const bump = status === 'weak' || status === 'shaky'
        file.byId[id] = {
          id,
          subject: payload.subject,
          status,
          root: status === 'weak' && rootIds.has(id),
          hits: (previous?.hits ?? 0) + (bump ? 1 : 0),
          wrongs: (previous?.wrongs ?? 0) + (wrongs[id] ?? 0),
          lastAt: now,
          lastLabel: payload.label || previous?.lastLabel || '',
          lastKey: payload.key || previous?.lastKey || '',
        }
      }
    }

    put(payload.summary.mastered, 'mastered')
    put(payload.summary.shaky, 'shaky')
    put(payload.summary.weak, 'weak')

    const entries = Object.entries(file.byId)
    if (entries.length > MAX_TOPICS) {
      entries.sort(([, a], [, b]) => b.lastAt.localeCompare(a.lastAt))
      file.byId = Object.fromEntries(entries.slice(0, MAX_TOPICS))
    }

    const ok = writeJson(STORAGE_KEY, file)
    if (ok) refresh()
    return ok
  }

  function fromLedger(subject: SubjectCode | null): Map<string, BlindRow> {
    // Depend on version so computed lists refresh after noteResult.
    void version.value
    const rows = new Map<string, BlindRow>()
    for (const record of Object.values(readBlindFile().byId)) {
      if (record.status === 'mastered') continue
      if (subject && record.subject !== subject) continue
      rows.set(record.id, {
        id: record.id,
        subject: record.subject,
        status: record.status,
        root: record.root,
        hits: record.hits,
        wrongs: record.wrongs,
        at: record.lastAt,
        label: record.lastLabel,
        source: 'local',
      })
    }
    return rows
  }

  function fromSessions(subject: SubjectCode | null): Map<string, BlindRow> {
    const rows = new Map<string, BlindRow>()
    for (const definition of SUBJECTS) {
      if (subject && definition.code !== subject) continue
      const session = readJson<SavedSession>(definition.storageKey, (value): value is SavedSession => {
        if (typeof value !== 'object' || value === null) return false
        const record = value as Record<string, unknown>
        return Array.isArray(record.answers)
      })
      if (!session?.answers.length) continue
      const counts = tallyWrongs(session.answers)
      for (const [id, wrongs] of Object.entries(counts)) {
        rows.set(id, {
          id,
          subject: definition.code,
          status: 'shaky',
          root: false,
          hits: 1,
          wrongs,
          at: session.savedAt ?? '',
          label: session.label ?? '未完成的诊断',
          source: 'session',
        })
      }
    }
    return rows
  }

  function fromChild(subject: SubjectCode | null): Map<string, BlindRow> {
    const rows = new Map<string, BlindRow>()
    const child = legacyChildren.current()
    if (!child) return rows
    const latest = legacyChildren.latestStatus(child.id, subject ?? undefined)
    for (const [id, info] of Object.entries(latest)) {
      if (info.status === 'mastered') continue
      if (subject && info.subject !== subject) continue
      if (!isSubject(info.subject)) continue
      rows.set(id, {
        id,
        subject: info.subject,
        status: info.status,
        root: info.root,
        hits: 1,
        wrongs: 0,
        at: info.at,
        label: info.label,
        source: 'child',
      })
    }
    return rows
  }

  function mergeMaps(maps: Map<string, BlindRow>[]): Map<string, BlindRow> {
    const merged = new Map<string, BlindRow>()
    for (const map of maps) {
      for (const [id, row] of map) {
        const previous = merged.get(id)
        if (!previous) {
          merged.set(id, { ...row })
          continue
        }
        const newer = row.at.localeCompare(previous.at) >= 0
        if (newer) {
          merged.set(id, { ...row, hits: Math.max(row.hits, previous.hits), wrongs: Math.max(row.wrongs, previous.wrongs) })
        } else {
          previous.hits = Math.max(previous.hits, row.hits)
          previous.wrongs = Math.max(previous.wrongs, row.wrongs)
        }
      }
    }
    return merged
  }

  function list(subject: SubjectCode | null = null, limit?: number): BlindRow[] {
    const rows = sortRows([...mergeMaps([fromSessions(subject), fromLedger(subject), fromChild(subject)]).values()])
    return typeof limit === 'number' ? rows.slice(0, limit) : rows
  }

  const count = computed(() => list(null).length)

  function clear() {
    writeJson(STORAGE_KEY, emptyFile())
    refresh()
  }

  function diagnoseHref(ids: string[], subject: SubjectCode | null = null): string {
    if (ids.length === 0) return subject && subject !== 'math' ? `/diagnose/?subject=${subject}` : '/diagnose/'
    const resolvedSubject = subject ?? subjectFromTopicId(ids[0] ?? '') ?? 'math'
    const query = new URLSearchParams({ target: ids.join(',') })
    if (resolvedSubject !== 'math') query.set('subject', resolvedSubject)
    return `/diagnose/?${query.toString()}`
  }

  return { noteResult, list, count, clear, refresh, diagnoseHref }
})
