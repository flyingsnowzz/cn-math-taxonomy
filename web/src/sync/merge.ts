/**
 * 云同步的纯函数合并器：不访问网络/localStorage，便于单测。
 *
 * 策略：
 * - lww：整键最后写入获胜（补救计划）
 * - unionStringArray：字符串数组取并集（shortfall）
 * - blindLedger：盲区台账 byId 条目合并（计数取大、mastered 优先、lastAt 取新）
 * - childrenProfiles：孩子档案按 id 合并
 * - childrenRecords：每个孩子的记录按 key 去重合并
 */

export type MergeStrategy = 'lww' | 'unionStringArray' | 'blindLedger' | 'childrenProfiles' | 'childrenRecords'

export interface KeySpec {
  match: (key: string) => boolean
  strategy: MergeStrategy
}

export const SYNC_KEY_SPECS: KeySpec[] = [
  { match: (key) => /^cnmRemedy\.plan\.[a-z]+\.v1$/.test(key), strategy: 'lww' },
  { match: (key) => key === 'cnmRemedy.shortfall.v1', strategy: 'unionStringArray' },
  { match: (key) => key === 'cnmBlind.local.v1', strategy: 'blindLedger' },
  { match: (key) => key === 'cnmChildren.v1', strategy: 'childrenProfiles' },
  { match: (key) => key === 'cnmChildren.records.v1', strategy: 'childrenRecords' },
]

export function specForKey(key: string): KeySpec | undefined {
  return SYNC_KEY_SPECS.find((spec) => spec.match(key))
}

export function isSyncKey(key: string): boolean {
  return specForKey(key) !== undefined
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface BlindEntry {
  id?: string
  subject?: string
  status?: string
  root?: boolean
  hits?: number
  wrongs?: number
  lastAt?: string
  lastLabel?: string
  lastKey?: string
  [key: string]: unknown
}

interface BlindFile { v: number; byId: Record<string, BlindEntry> }

interface ChildProfile {
  id: string
  name?: string
  createdAt?: string
  updatedAt?: string
  [key: string]: unknown
}

interface ChildrenFile { v: number; current: string | null; children: ChildProfile[] }

type RecordsFile = Record<string, Array<Record<string, unknown>>>

/**
 * 把远端数据合并进本地数据，返回 { data, changed }。
 * lww 用 updatedAt 比较；结构化策略做条目级合并，不丢任一侧新增。
 */
export function mergeBlob(
  key: string,
  remote: unknown,
  local: unknown,
  localUpdatedAt: number,
  remoteUpdatedAt: number,
): { data: unknown; changed: boolean } {
  const spec = specForKey(key)
  if (!spec) return { data: local, changed: false }

  switch (spec.strategy) {
    case 'lww':
      if (remoteUpdatedAt > localUpdatedAt) return { data: remote, changed: true }
      return { data: local, changed: false }

    case 'unionStringArray': {
      const a = Array.isArray(remote) ? remote.filter((x): x is string => typeof x === 'string') : []
      const b = Array.isArray(local) ? local.filter((x): x is string => typeof x === 'string') : []
      const merged = Array.from(new Set([...a, ...b]))
      return { data: merged, changed: merged.length !== b.length }
    }

    case 'blindLedger': {
      const rem = isObject(remote) && isObject(remote.byId)
        ? remote.byId as Record<string, BlindEntry>
        : {}
      const locFile: BlindFile = isObject(local) && isObject(local.byId)
        ? local as unknown as BlindFile
        : { v: 1, byId: {} }
      const loc = locFile.byId
      let changed = false
      for (const [id, r] of Object.entries(rem)) {
        const l = loc[id]
        if (!l) {
          loc[id] = r
          changed = true
        } else {
          const mergedEntry = mergeBlindEntry(l, r)
          if (mergedEntry.changed) {
            loc[id] = mergedEntry.entry
            changed = true
          }
        }
      }
      return { data: locFile, changed }
    }

    case 'childrenProfiles': {
      const rem = isObject(remote) && Array.isArray(remote.children)
        ? (remote.children as unknown[]).filter(isChildProfile)
        : []
      const locFile: ChildrenFile = isObject(local) && Array.isArray(local.children)
        ? local as unknown as ChildrenFile
        : { v: 1, current: null, children: [] }
      let changed = false
      for (const child of rem) {
        const idx = locFile.children.findIndex((c) => c.id === child.id)
        if (idx === -1) {
          locFile.children.push(child)
          changed = true
        } else {
          const remoteUpdated = Date.parse(child.updatedAt ?? child.createdAt ?? '') || 0
          const current = locFile.children[idx]
          const localUpdated = current
            ? Date.parse(current.updatedAt ?? current.createdAt ?? '') || 0
            : 0
          if (remoteUpdated >= localUpdated) {
            locFile.children[idx] = child
            changed = true
          }
        }
      }
      if (locFile.current && !locFile.children.some((c) => c.id === locFile.current)) {
        locFile.current = locFile.children[0]?.id ?? null
      }
      if (!locFile.current && locFile.children[0]) locFile.current = locFile.children[0].id
      return { data: locFile, changed }
    }

    case 'childrenRecords': {
      const rem = isObject(remote) ? remote as RecordsFile : {}
      const loc = isObject(local) ? local as RecordsFile : {}
      let changed = false
      for (const [childId, remoteRecords] of Object.entries(rem)) {
        if (!Array.isArray(remoteRecords)) continue
        const localRecords = loc[childId] ?? []
        const existing = new Map(localRecords.map((r) => [recordKey(r), r]))
        for (const record of remoteRecords) existing.set(recordKey(record), record)
        const merged = Array.from(existing.values()).sort(compareRecords).slice(-40)
        if (JSON.stringify(merged) !== JSON.stringify(localRecords)) {
          loc[childId] = merged
          changed = true
        }
      }
      return { data: loc, changed }
    }
  }
}

function isChildProfile(value: unknown): value is ChildProfile {
  return isObject(value) && typeof value.id === 'string'
}

function mergeBlindEntry(local: BlindEntry, remote: BlindEntry): { entry: BlindEntry; changed: boolean } {
  const entry = { ...local }
  let changed = false
  if (Number(remote.wrongs ?? 0) > Number(local.wrongs ?? 0)) { entry.wrongs = remote.wrongs; changed = true }
  if (Number(remote.hits ?? 0) > Number(local.hits ?? 0)) { entry.hits = remote.hits; changed = true }
  const rank: Record<string, number> = { weak: 0, shaky: 1, mastered: 2 }
  if ((rank[remote.status ?? ''] ?? 0) > (rank[local.status ?? ''] ?? 0)) {
    entry.status = remote.status
    if (remote.root !== undefined) entry.root = remote.root
    changed = true
  }
  if (typeof remote.lastAt === 'string' && remote.lastAt > (local.lastAt ?? '')) {
    entry.lastAt = remote.lastAt
    entry.lastLabel = remote.lastLabel ?? local.lastLabel
    entry.lastKey = remote.lastKey ?? local.lastKey
    changed = true
  }
  if (remote.subject && !local.subject) { entry.subject = remote.subject; changed = true }
  return { entry, changed }
}

function recordKey(record: unknown): string {
  if (isObject(record) && typeof record.key === 'string') return record.key
  if (isObject(record) && typeof record.savedAt === 'string') return record.savedAt
  return JSON.stringify(record)
}

function compareRecords(a: unknown, b: unknown): number {
  const ta = isObject(a) && typeof a.savedAt === 'string' ? a.savedAt : ''
  const tb = isObject(b) && typeof b.savedAt === 'string' ? b.savedAt : ''
  return ta.localeCompare(tb)
}
