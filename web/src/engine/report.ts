import type { SubjectCode } from '@/data/types'
import type { RemedyPlan } from './remediationAdapter'

export interface ReportTopicInfo {
  name: string
  chapter?: string
}

export interface ReportContext {
  subject: SubjectCode
  resolveTopic: (id: string) => ReportTopicInfo | null
  /** 诊断目标名（如「配方法」），缺省时由 plan.targets 解析 */
  targetLabel?: string
  now?: number
}

export interface ReportPathItem {
  id: string
  name: string
  chapter: string
  kind: 'weak' | 'shaky'
  isRoot: boolean
  isTarget: boolean
  mastered: boolean
  wrongs: number
}

export interface RemedyReport {
  v: 1
  subject: SubjectCode
  generatedAt: string
  targetLabel: string
  totals: {
    cards: number
    mastered: number
    remaining: number
    roots: number
    rootsMastered: number
    questionsDone: number
  }
  /** 用时毫秒（从建计划到最后一次复测通过；未完成任何卡为 null） */
  durationMs: number | null
  path: ReportPathItem[]
}

function dayStamp(now: number): string {
  return new Date(now).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

/**
 * 从补救计划生成家长报告。纯函数，不访问 DOM/localStorage，便于测试与分享复用。
 */
export function buildReport(plan: RemedyPlan, context: ReportContext): RemedyReport {
  const now = context.now ?? Date.now()
  const resolveName = (id: string): string => context.resolveTopic(id)?.name ?? id

  const path: ReportPathItem[] = plan.cards.map((card) => ({
    id: card.topicId,
    name: resolveName(card.topicId),
    chapter: context.resolveTopic(card.topicId)?.chapter ?? '',
    kind: card.kind,
    isRoot: card.isRoot,
    isTarget: card.isTarget,
    mastered: card.state === 'mastered',
    wrongs: card.wrongs,
  }))

  const mastered = path.filter((item) => item.mastered)
  const roots = path.filter((item) => item.isRoot)
  const masteredAt = plan.cards
    .map((card) => card.masteredAt)
    .filter((value): value is number => typeof value === 'number')
  const lastMastered = masteredAt.length ? Math.max(...masteredAt) : null

  return {
    v: 1,
    subject: context.subject,
    generatedAt: dayStamp(now),
    targetLabel: context.targetLabel || plan.targets.map(resolveName).join('、'),
    totals: {
      cards: path.length,
      mastered: mastered.length,
      remaining: path.length - mastered.length,
      roots: roots.length,
      rootsMastered: roots.filter((item) => item.mastered).length,
      questionsDone: plan.usedIds.length,
    },
    durationMs: lastMastered === null ? null : Math.max(0, lastMastered - plan.createdAt),
    path,
  }
}

/**
 * 公开摘要版：去掉一切可能识别个人的信息（本系统没有昵称字段，
 * 这里仍显式白名单，供分享链接的免登查看使用）。
 */
export interface PublicRemedyReport {
  v: 1
  subject: SubjectCode
  generatedAt: string
  targetLabel: string
  totals: RemedyReport['totals']
  durationMs: number | null
  path: Array<Pick<ReportPathItem, 'name' | 'chapter' | 'kind' | 'isRoot' | 'isTarget' | 'mastered'>>
}

export function toPublicReport(report: RemedyReport): PublicRemedyReport {
  return {
    v: 1,
    subject: report.subject,
    generatedAt: report.generatedAt,
    targetLabel: report.targetLabel,
    totals: report.totals,
    durationMs: report.durationMs,
    path: report.path.map((item) => ({
      name: item.name,
      chapter: item.chapter,
      kind: item.kind,
      isRoot: item.isRoot,
      isTarget: item.isTarget,
      mastered: item.mastered,
    })),
  }
}

export function encodePublicReport(report: PublicRemedyReport): string {
  const json = JSON.stringify(report)
  // Unicode 安全的 base64url
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodePublicReport(payload: string): PublicRemedyReport | null {
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (typeof parsed !== 'object' || parsed === null) return null
    const record = parsed as Record<string, unknown>
    if (record.v !== 1 || typeof record.subject !== 'string' || typeof record.totals !== 'object') {
      return null
    }
    return record as unknown as PublicRemedyReport
  } catch {
    return null
  }
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return '不足 1 分钟'
  if (minutes < 60) return `约 ${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `约 ${hours} 小时` : `约 ${hours} 小时 ${rest} 分`
}
