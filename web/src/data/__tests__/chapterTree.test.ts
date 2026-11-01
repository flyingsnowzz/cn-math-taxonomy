import { describe, expect, it } from 'vitest'
import { buildChapterTree } from '../chapterTree'
import type { Topic } from '../types'

const topics: Topic[] = [
  { id: 'cnm_1', name: '有理数', domain: '数与代数', grade: 7, chapter: '七上 第一章 有理数 1.1', type: 'conceptual' },
  { id: 'cnm_2', name: '绝对值', domain: '数与代数', grade: 7, chapter: '七上 第一章 有理数 1.2', type: 'conceptual' },
  { id: 'cnm_3', name: '整式', domain: '数与代数', grade: 7, chapter: '七上 第二章 整式的加减 2.1', type: 'conceptual' },
]

describe('buildChapterTree', () => {
  it('groups topics by parsed volume and chapter', () => {
    const tree = buildChapterTree(topics)
    expect(tree.volumes).toHaveLength(1)
    expect(tree.volumes[0]?.volume).toBe('七上')
    expect(tree.volumes[0]?.chapters).toHaveLength(2)
    expect(tree.chaptersByKey.get('七上 第一章')?.topics).toHaveLength(2)
  })
})
