/**
 * 本地漏斗埋点（M1：只存本机 localStorage，不发网络请求）。
 * M3 接入后端时只替换 flush/transport，事件名与载荷保持不变。
 */

export type TrackEventName =
  | 'diagnose_start'
  | 'diagnose_done'
  | 'practice_start'
  | 'practice_done'
  | 'help_view'
  | 'retest_pass'
  | 'report_share'

export interface TrackEvent {
  name: TrackEventName
  at: string
  payload?: Record<string, string | number | boolean>
}

const STORAGE_KEY = 'cnmTrack.v1'
const MAX_EVENTS = 1000

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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch {
    // 隐私模式/配额不足时埋点静默失败，不影响主流程
  }
}

export function track(name: TrackEventName, payload?: TrackEvent['payload']): void {
  const event: TrackEvent = { name, at: new Date().toISOString(), payload }
  const events = readEvents()
  events.push(event)
  writeEvents(events.slice(-MAX_EVENTS))
}

export function clearEvents(): void {
  writeEvents([])
}
