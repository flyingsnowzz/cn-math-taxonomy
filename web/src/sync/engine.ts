/**
 * 云同步引擎。
 *
 * 职责：
 * - pull：登录后拉取云端 blob，与本地按策略合并，回写 localStorage 并发出变更事件
 * - push：本地写入后 markDirty(key)，防抖 2s 批量推送；断网积压，online/页面重新可见时 flush
 * - 未登录：什么都不做（公开页面零网络请求）
 *
 * 本地时间戳记在 cnmSync.meta.v1：{ [key]: number(ms) }
 */
import { api } from '@/api/client'
import { readJson, writeJson } from '@/utils/storage'
import { isSyncKey, mergeBlob, specForKey } from './merge'
import { SUBJECTS } from '@/data/subjectRegistry'

const META_KEY = 'cnmSync.meta.v1'
const DEBOUNCE_MS = 2000

interface MetaFile {
  v: 1
  updatedAt: Record<string, number>
}

interface RemoteItem {
  key: string
  data: unknown
  updatedAt: number
}

interface SyncEvents {
  onRemoteMerged?: (keys: string[]) => void
}

function readMeta(): Record<string, number> {
  return readJson<MetaFile>(META_KEY, (v): v is MetaFile =>
    typeof v === 'object' && v !== null && (v as MetaFile).v === 1
    && typeof (v as MetaFile).updatedAt === 'object')?.updatedAt ?? {}
}

function writeMeta(meta: Record<string, number>): void {
  const file: MetaFile = { v: 1, updatedAt: meta }
  writeJson(META_KEY, file)
}

function readLocal(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? undefined : JSON.parse(raw)
  } catch {
    return undefined
  }
}

function writeLocal(key: string, data: unknown): void {
  writeJson(key, data)
}

export function createSyncEngine(events: SyncEvents = {}) {
  let isLoggedIn = false
  const dirty = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let flushing = false

  async function pull(): Promise<string[]> {
    if (!isLoggedIn) return []
    const keys = allKnownKeys()
    if (keys.length === 0) return []
    const body = await api.get<{ items: RemoteItem[] }>(`/sync?keys=${encodeURIComponent(keys.join(','))}`)
    const meta = readMeta()
    const mergedKeys: string[] = []
    for (const remote of body.items) {
      if (!isSyncKey(remote.key)) continue
      const local = readLocal(remote.key)
      const localAt = meta[remote.key] ?? 0
      const result = mergeBlob(remote.key, remote.data, local, localAt, remote.updatedAt)
      if (result.changed || local === undefined) {
        writeLocal(remote.key, result.data)
        meta[remote.key] = Math.max(localAt, remote.updatedAt)
        mergedKeys.push(remote.key)
      }
    }
    writeMeta(meta)
    if (mergedKeys.length) events.onRemoteMerged?.(mergedKeys)
    return mergedKeys
  }

  async function flush(): Promise<void> {
    if (!isLoggedIn || flushing || dirty.size === 0) return
    flushing = true
    const keys = Array.from(dirty)
    const meta = readMeta()
    const items = keys.map((key) => ({
      key,
      data: readLocal(key),
      updatedAt: meta[key] ?? Date.now(),
    })).filter((item) => item.data !== undefined)

    try {
      const body = await api.post<{ items: Array<{ key: string; updatedAt: number; changed: boolean }> }>(
        '/sync',
        { items },
        true,
      )
      for (const result of body.items) {
        meta[result.key] = result.updatedAt
        dirty.delete(result.key)
      }
      writeMeta(meta)
    } catch {
      // 保留 dirty，等下次 online/flush 重试
    } finally {
      flushing = false
    }
  }

  function schedulePush(): void {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void flush()
    }, DEBOUNCE_MS)
  }

  function markDirty(key: string): void {
    if (!isLoggedIn || !isSyncKey(key)) return
    const meta = readMeta()
    meta[key] = Date.now()
    writeMeta(meta)
    dirty.add(key)
    schedulePush()
  }

  async function login(): Promise<void> {
    isLoggedIn = true
    await pull().catch(() => { /* 拉取失败不阻断登录后的本地使用 */ })
    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisible)
  }

  function logout(): void {
    isLoggedIn = false
    dirty.clear()
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    window.removeEventListener('online', handleOnline)
    document.removeEventListener('visibilitychange', handleVisible)
  }

  function handleOnline(): void {
    void flush()
  }

  function handleVisible(): void {
    if (document.visibilityState === 'visible') void flush()
  }

  return { login, logout, pull, flush, markDirty, isSyncKey }
}

/** 所有需要拉取的键：固定键 + 所有学科的补救计划键（新设备本地没有也要拉）。 */
export function allKnownKeys(): string[] {
  const fixed = [
    'cnmRemedy.shortfall.v1',
    'cnmBlind.local.v1',
    'cnmChildren.v1',
    'cnmChildren.records.v1',
  ]
  const plans = SUBJECTS.map((subject) => `cnmRemedy.plan.${subject.code}.v1`)
  return Array.from(new Set([...fixed, ...plans]))
}

export function strategyOf(key: string) {
  return specForKey(key)?.strategy
}
