import { describe, expect, it } from 'vitest'
import { normalizeSubject, subjectFromTopicId, subjectOfTopic } from '../subjectRegistry'

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

  it('uses explicit topic.subject before id prefix', () => {
    expect(subjectOfTopic({ id: 'cnm_1', subject: 'english' } as never)).toBe('english')
    expect(subjectOfTopic({ id: 'cne_1' } as never)).toBe('english')
  })
})
