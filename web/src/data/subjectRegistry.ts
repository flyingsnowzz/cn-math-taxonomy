import type { SubjectCode, Topic } from './types'

export interface SubjectDefinition {
  code: SubjectCode
  label: string
  idPrefix: string
  graphColor: string
  softColor: string
  storageKey: string
}

export const SUBJECTS: SubjectDefinition[] = [
  {
    code: 'math',
    label: '数学',
    idPrefix: 'cnm_',
    graphColor: '#2f6fed',
    softColor: '#8ab4f8',
    storageKey: 'cnmDiagnose.session.v2',
  },
  {
    code: 'english',
    label: '英语',
    idPrefix: 'cne_',
    graphColor: '#7564c8',
    softColor: '#b5abe4',
    storageKey: 'cneDiagnose.session.v2',
  },
  {
    code: 'physics',
    label: '物理',
    idPrefix: 'cnp_',
    graphColor: '#3f7191',
    softColor: '#91b0c5',
    storageKey: 'cnpDiagnose.session.v2',
  },
  {
    code: 'chinese',
    label: '语文',
    idPrefix: 'cnc_',
    graphColor: '#b65f43',
    softColor: '#d99a84',
    storageKey: 'cncDiagnose.session.v2',
  },
  {
    code: 'science',
    label: '科学',
    idPrefix: 'cns_',
    graphColor: '#557d3e',
    softColor: '#9bbf83',
    storageKey: 'cnsDiagnose.session.v1',
  },
  {
    code: 'morality',
    label: '道德与法治',
    idPrefix: 'cnd_',
    graphColor: '#9b6c3d',
    softColor: '#caa47c',
    storageKey: 'cndDiagnose.session.v1',
  },
  {
    code: 'history',
    label: '历史',
    idPrefix: 'cnh_',
    graphColor: '#a55f54',
    softColor: '#d09a91',
    storageKey: 'cnhDiagnose.session.v1',
  },
  {
    code: 'geography',
    label: '地理',
    idPrefix: 'cng_',
    graphColor: '#23816f',
    softColor: '#7cbcad',
    storageKey: 'cngDiagnose.session.v1',
  },
]

export const SUBJECT_BY_CODE = new Map(SUBJECTS.map((subject) => [subject.code, subject]))

const SUBJECT_BY_PREFIX = new Map(SUBJECTS.map((subject) => [subject.idPrefix, subject]))

export function isSubjectCode(value: unknown): value is SubjectCode {
  return typeof value === 'string' && SUBJECT_BY_CODE.has(value as SubjectCode)
}

export function normalizeSubject(value: unknown): SubjectCode {
  return isSubjectCode(value) ? value : 'math'
}

export function getSubject(code: SubjectCode): SubjectDefinition {
  return SUBJECT_BY_CODE.get(code) ?? SUBJECTS[0]!
}

export function subjectFromTopicId(id: string): SubjectCode | null {
  const match = /^(cn[mepcsdnhg])_/.exec(id)
  if (!match) return null
  const prefix = `${match[1]}_`
  return SUBJECT_BY_PREFIX.get(prefix)?.code ?? null
}

export function subjectOfTopic(topic: Pick<Topic, 'id' | 'subject'>): SubjectCode {
  if (isSubjectCode(topic.subject)) return topic.subject
  return subjectFromTopicId(topic.id) ?? 'math'
}

export function topicStage(topic: Topic): 'primary' | 'junior' | 'senior' {
  if (topic.grade <= 6) return 'primary'
  if (topic.grade <= 9) return 'junior'
  return 'senior'
}


const CN_NUMERALS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']

export function formatGradeForSubject(subject: SubjectCode, grade: number): string {
  if (grade >= 1 && grade <= 9) return `${CN_NUMERALS[grade]}年级`

  if (subject === 'english') {
    return {
      10: '必修一',
      11: '必修二',
      12: '必修三',
      13: '选必一',
      14: '选必二',
      15: '选必三',
      16: '选必四',
    }[grade] ?? `${grade} 年级`
  }

  if (subject === 'physics') {
    return {
      10: '必修一',
      11: '必修二',
      12: '必修三',
      13: '选必一',
      14: '选必二',
      15: '选必三',
    }[grade] ?? `${grade} 年级`
  }

  if (subject === 'math') {
    return {
      10: '高一',
      11: '高二',
      12: '选必一',
      13: '选必二',
      14: '选必三',
    }[grade] ?? `${grade} 年级`
  }

  return `${grade} 年级`
}
