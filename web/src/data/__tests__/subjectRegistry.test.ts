import { describe, expect, it } from 'vitest'
import { formatGradeForSubject, normalizeSubject, subjectFromTopicId, subjectOfTopic } from '../subjectRegistry'

describe('subjectRegistry', () => {
  it('recognizes each official subject prefix', () => {
    expect(subjectFromTopicId('cnm_221')).toBe('math')
    expect(subjectFromTopicId('cne_p001')).toBe('english')
    expect(subjectFromTopicId('cnp_h001')).toBe('physics')
    expect(subjectFromTopicId('cnc_p001')).toBe('chinese')
    expect(subjectFromTopicId('cns_p001')).toBe('science')
    expect(subjectFromTopicId('cnd_p001')).toBe('morality')
    expect(subjectFromTopicId('cnh_j001')).toBe('history')
    expect(subjectFromTopicId('cng_j001')).toBe('geography')
  })

  it('falls back to math for unknown subjects and malformed ids', () => {
    expect(normalizeSubject('unknown')).toBe('math')
    expect(normalizeSubject(undefined)).toBe('math')
    expect(subjectFromTopicId('abc_001')).toBeNull()
  })

  it('formats high-school grade numbers with subject-specific book labels', () => {
    expect(formatGradeForSubject('math', 10)).toBe('高一')
    expect(formatGradeForSubject('math', 12)).toBe('选必一')
    expect(formatGradeForSubject('english', 10)).toBe('必修一')
    expect(formatGradeForSubject('english', 16)).toBe('选必四')
    expect(formatGradeForSubject('physics', 15)).toBe('选必三')
    expect(formatGradeForSubject('english', 3)).toBe('三年级')
  })

  it('uses explicit topic.subject before id prefix', () => {
    expect(subjectOfTopic({ id: 'cnm_1', subject: 'english' } as never)).toBe('english')
    expect(subjectOfTopic({ id: 'cne_1' } as never)).toBe('english')
  })
})
