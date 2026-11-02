/**
 * 埋点：本地缓冲 + 登录后批量上报。
 * - 未登录：只写本地，不发请求。
 * - 登录后：每 20 秒或页面隐藏时 flush；失败保留待上报，online 时重试。
 * - 每条事件有 uid，服务端按 client_uid 去重，重试不会产生重复记录。
 */
import { api } from '@/api/client'

export type TrackEventName =
  | 'diagnose_start'
  | 'diagnose_done'
  | 'practice_start'
  | 'practice_done'
  | 'help_view'
  | 'retest_pass'
  | 'report_share'
  | 'video_open'
  | 'paywall_view'

export interface TrackEvent {
  name: TrackEventName
  at: string
  uid: string
  payload?: Record<string, string | number | boolean>
  uploaded?: boolean
}

const STORAGE_KEY = 'cnmTrack.v1'
const DEVICE_KEY = 'cnmDevice.v1'
const MAX_EVENTS = 1000
const FLUSH_INTERVAL_MS = 20_000

let transportEnabled = false
let timer: ReturnType<typeof setInterval> | null = null
let flushing = false

function newUid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function isValidEvent(value: unknown): value is TrackEvent {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.name === 'string' && typeof record.at === 'string'
}

export function readEvents(): TrackEvent[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidEvent)
  } catch {
    return []
  }
}

function writeEvents(events: TrackEvent[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)))
  } catch {
    // 隐私模式/配额不足时埋点静默失败，不影响主流程
  }
}

export function deviceId(): string {
  try {
    let id = window.localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = `dev-${newUid()}`
      window.localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return 'dev-unavailable'
  }
}

export function track(name: TrackEventName, payload?: TrackEvent['payload']): void {
  const event: TrackEvent = { name, at: new Date().toISOString(), uid: newUid(), payload }
  const events = readEvents()
  events.push(event)
  writeEvents(events)
}

/** 未上报的事件（兼容旧版没有 uid 的数据：补 uid 后参与上报）。 */
export function pendingEvents(): TrackEvent[] {
  const events = readEvents()
  let changed = false
  for (const event of events) {
    if (!event.uid) {
      event.uid = newUid()
      changed = true
    }
  }
  if (changed) writeEvents(events)
  return events.filter((event) => !event.uploaded)
}

export async function flushEvents(): Promise<{ uploaded: number }> {
  if (!transportEnabled || flushing) return { uploaded: 0 }
  const pending = pendingEvents().slice(0, 100)
  if (pending.length === 0) return { uploaded: 0 }
  flushing = true
  try {
    await api.post('/track', {
      deviceId: deviceId(),
      events: pending.map((event) => ({
        uid: event.uid,
        name: event.name,
        payload: event.payload,
        clientAt: event.at,
      })),
    }, true)
    const uploadedUids = new Set(pending.map((event) => event.uid))
    writeEvents(readEvents().map((event) => (uploadedUids.has(event.uid) ? { ...event, uploaded: true } : event)))
    return { uploaded: pending.length }
  } catch {
    // 保留本地待上报，定时器/online 时重试
    return { uploaded: 0 }
  } finally {
    flushing = false
  }
}

function handleVisibility(): void {
  if (document.visibilityState === 'hidden') void flushEvents()
}

function handleOnline(): void {
  void flushEvents()
}

/** 登录后开启上报（auth store 调用）；flushNow=false 供测试控制时机。 */
export function enableTrackingTransport(flushNow = true): void {
  if (transportEnabled) return
  transportEnabled = true
  timer = setInterval(() => void flushEvents(), FLUSH_INTERVAL_MS)
  document.addEventListener('visibilitychange', handleVisibility)
  window.addEventListener('online', handleOnline)
  if (flushNow) void flushEvents()
}

/** 登出后停止上报，本地事件保留。 */
export function disableTrackingTransport(): void {
  transportEnabled = false
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  document.removeEventListener('visibilitychange', handleVisibility)
  window.removeEventListener('online', handleOnline)
}

export function isTrackingEnabled(): boolean {
  return transportEnabled
}

export function clearEvents(): void {
  writeEvents([])
}
