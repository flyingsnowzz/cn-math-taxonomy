import type { GraphDataset, QuestionDataset, SubjectCode } from './types'
import {
  parseAliases,
  parseEdges,
  parseQuestions,
  parseStandards,
  parseTopics,
} from './guards'

const DATA_BASE = `${import.meta.env.BASE_URL}data/`

export async function loadSubjectDataset(subject: SubjectCode, signal?: AbortSignal): Promise<GraphDataset> {
  const response = await fetch(`${DATA_BASE}subjects/${subject}.json`, { signal })
  if (!response.ok) {
    throw new Error(`无法加载 ${subject} 学科数据包：HTTP ${response.status}`)
  }
  const raw: unknown = await response.json()
  if (typeof raw !== 'object' || raw === null) throw new Error('学科数据包必须是对象')
  const record = raw as Record<string, unknown>

  return {
    topics: parseTopics(record.topics),
    edges: parseEdges(record.edges),
    standards: parseStandards(record.standards),
    aliases: parseAliases(record.aliases),
  }
}

export async function loadSubjectQuestions(subject: SubjectCode, signal?: AbortSignal): Promise<QuestionDataset> {
  const response = await fetch(`${DATA_BASE}subjects/${subject}-questions.json`, { signal })
  if (!response.ok) {
    throw new Error(`无法加载 ${subject} 题库：HTTP ${response.status}`)
  }
  const raw: unknown = await response.json()
  if (typeof raw !== 'object' || raw === null) throw new Error('学科题库必须是对象')
  const record = raw as Record<string, unknown>
  return { subject, questions: parseQuestions(record.questions) }
}

export interface SubjectStats {
  topics: number
  edges: number
  questions: number
  standards: number
}

export interface GlobalStats {
  generatedAt: string
  totalTopics: number
  totalEdges: number
  totalQuestions: number
  subjects: Record<SubjectCode, SubjectStats>
}

export async function loadStats(): Promise<GlobalStats> {
  const response = await fetch(`${DATA_BASE}stats.json`)
  if (!response.ok) throw new Error(`无法加载 stats.json：HTTP ${response.status}`)
  const raw: unknown = await response.json()
  if (typeof raw !== 'object' || raw === null) throw new Error('stats.json 必须是对象')
  return raw as GlobalStats
}
