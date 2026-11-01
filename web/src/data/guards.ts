import type {
  CurriculumStandardItem,
  CurriculumStandardsFile,
  DependencyEdge,
  IdAliasesFile,
  Question,
  Topic,
} from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${context}: ${key} 必须是非空字符串`)
  }
  return value
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function optionalBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key]
  return typeof value === 'boolean' ? value : undefined
}

function optionalStringArray(record: Record<string, unknown>, key: string): string[] | undefined {
  const value = record[key]
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? (value as string[])
    : undefined
}

function isTopic(value: unknown, index: number): value is Topic {
  if (!isRecord(value)) throw new Error(`topics[${index}] 必须是对象`)
  const topic: Topic = {
    id: requireString(value, 'id', `topics[${index}]`),
    name: requireString(value, 'name', `topics[${index}]`),
    domain: requireString(value, 'domain', `topics[${index}]`),
    chapter: requireString(value, 'chapter', `topics[${index}]`),
    type: requireString(value, 'type', `topics[${index}]`),
    grade: requireNumber(value, 'grade', `topics[${index}]`),
  }
  assignOptionalTopicFields(topic, value)
  return true
}

function requireNumber(record: Record<string, unknown>, key: string, context: string): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${context}: ${key} 必须是数字`)
  }
  return value
}

function assignOptionalTopicFields(topic: Topic, value: Record<string, unknown>): void {
  topic.semester = optionalString(value, 'semester')
  topic.description = optionalString(value, 'description')
  topic.mastery_criteria = optionalStringArray(value, 'mastery_criteria')
  topic.external = optionalBoolean(value, 'external')
  topic.root_reason = optionalString(value, 'root_reason')
  const mathLinks = optionalStringArray(value, 'mathLinks')
  if (mathLinks) topic.mathLinks = mathLinks
  const diagnostic = value.diagnostic_question
  if (isRecord(diagnostic)) {
    const question = optionalString(diagnostic, 'question')
    const answer = optionalString(diagnostic, 'answer')
    if (question && answer) topic.diagnostic_question = { question, answer }
  }
  const standards = value.standards
  if (Array.isArray(standards)) {
    topic.standards = standards.flatMap((item) => {
      if (!isRecord(item) || typeof item.id !== 'string') return []
      return [{ id: item.id, confidence: item.confidence === 'exact' || item.confidence === 'inferred' ? item.confidence : undefined, note: typeof item.note === 'string' ? item.note : undefined }]
    })
  }
}

function isEdge(value: unknown, index: number): value is DependencyEdge {
  if (!isRecord(value)) throw new Error(`dependencies[${index}] 必须是对象`)
  const edge: DependencyEdge = {
    topicId: requireString(value, 'topicId', `dependencies[${index}]`),
    prerequisiteId: requireString(value, 'prerequisiteId', `dependencies[${index}]`),
    strength: typeof value.strength === 'string' ? value.strength : 'hard',
  }
  edge.reason = optionalString(value, 'reason')
  return true
}

function isQuestion(value: unknown, index: number): value is Question {
  if (!isRecord(value)) throw new Error(`questions[${index}] 必须是对象`)
  const question: Question = {
    id: requireString(value, 'id', `questions[${index}]`),
    topicId: requireString(value, 'topicId', `questions[${index}]`),
    type: requireString(value, 'type', `questions[${index}]`),
    prompt: requireString(value, 'prompt', `questions[${index}]`),
    answer: requireString(value, 'answer', `questions[${index}]`),
  }
  const difficulty = optionalString(value, 'difficulty')
  if (difficulty) question.difficulty = difficulty
  question.explanation = optionalString(value, 'explanation')
  question.verify = optionalString(value, 'verify')
  const accept = optionalStringArray(value, 'accept')
  if (accept) question.accept = accept
  const choices = value.choices
  if (Array.isArray(choices)) {
    question.choices = choices.flatMap((choice) => {
      if (!isRecord(choice) || typeof choice.key !== 'string' || typeof choice.text !== 'string') return []
      return [{ key: choice.key, text: choice.text }]
    })
  }
  return true
}

function isStandardItem(value: unknown): value is CurriculumStandardItem {
  return isRecord(value) && typeof value.id === 'string'
}

export function parseTopics(value: unknown): Topic[] {
  if (!Array.isArray(value)) throw new Error('topics.json 必须是数组')
  value.forEach(isTopic)
  return value as Topic[]
}

export function parseEdges(value: unknown): DependencyEdge[] {
  if (!Array.isArray(value)) throw new Error('dependencies.json 必须是数组')
  value.forEach(isEdge)
  return value as DependencyEdge[]
}

export function parseQuestions(value: unknown): Question[] {
  if (!Array.isArray(value)) throw new Error('questions.json 必须是数组')
  value.forEach(isQuestion)
  return value as Question[]
}

export function parseStandards(value: unknown): CurriculumStandardsFile {
  if (!isRecord(value)) throw new Error('cn-curriculum-standards.json 必须是对象')
  if (value.items !== undefined && !Array.isArray(value.items)) {
    throw new Error('课标 items 必须是数组')
  }
  const items = Array.isArray(value.items) ? value.items.filter(isStandardItem) : []
  return { ...value, items } as CurriculumStandardsFile
}

export function parseAliases(value: unknown): IdAliasesFile {
  if (!isRecord(value) || !isRecord(value.aliases)) {
    throw new Error('id-aliases.json 必须包含 aliases 对象')
  }
  return value as unknown as IdAliasesFile
}

export function standardItems(file: CurriculumStandardsFile): CurriculumStandardItem[] {
  return file.items ?? []
}
