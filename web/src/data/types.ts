export type SubjectCode =
  | 'math'
  | 'english'
  | 'physics'
  | 'chinese'
  | 'science'
  | 'morality'
  | 'history'
  | 'geography'

export type EdgeStrength = 'hard' | 'soft'

export type QuestionType = 'choice' | 'numeric' | 'short' | 'self' | 'legacy' | string

export type Difficulty = 'basic' | 'standard' | 'challenge' | 'advanced' | string

export interface StandardRef {
  id: string
  confidence?: 'exact' | 'inferred'
  note?: string
}

export interface DiagnosticQuestion {
  question: string
  answer: string
}

export interface Topic {
  id: string
  name: string
  domain: string
  grade: number
  semester?: string
  chapter: string
  type: string
  description?: string
  mastery_criteria?: string[]
  diagnostic_question?: DiagnosticQuestion
  external?: boolean
  standards?: StandardRef[]
  subject?: SubjectCode
  root_reason?: string
  mathLinks?: string[]
}

export interface DependencyEdge {
  topicId: string
  prerequisiteId: string
  strength: EdgeStrength | string
  reason?: string
}

export interface QuestionChoice {
  key: string
  text: string
}

export interface Question {
  id: string
  topicId: string
  difficulty?: Difficulty
  type: QuestionType
  prompt: string
  answer: string
  choices?: QuestionChoice[]
  explanation?: string
  verify?: string
  accept?: string[]
}

export interface CurriculumStandardItem {
  id: string
  domain?: string
  section?: string
  clause?: string
  text?: string
  page_or_ref?: string
  verbatim?: boolean
}

export interface CurriculumStandardsFile {
  source?: Record<string, unknown>
  items?: CurriculumStandardItem[]
  [key: string]: unknown
}

export type AliasTargetList = string[] | { targets?: string[] }

export interface IdAliasesFile {
  description?: string
  aliases: Record<string, AliasTargetList>
}

export interface GraphDataset {
  topics: Topic[]
  edges: DependencyEdge[]
  standards: CurriculumStandardsFile
  aliases: IdAliasesFile
}

export interface QuestionDataset {
  subject: SubjectCode
  questions: Question[]
}
