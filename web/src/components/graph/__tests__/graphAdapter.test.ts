import { describe, expect, it } from 'vitest'
import { foldDiagnosticLayout, graphElements, graphFromDiagnosticLayout, selectNeighborhood } from '../graphAdapter'
import type { DependencyEdge, Topic } from '@/data/types'

const topics: Topic[] = [
  { id: 'cnm_p1', name: '小学基础', domain: '数与代数', grade: 1, chapter: '一上 第1章', type: 'conceptual' },
  { id: 'cnm_j1', name: '初中目标', domain: '数与代数', grade: 7, chapter: '七上 第1章', type: 'procedural' },
  { id: 'cnm_j2', name: '初中后续', domain: '数与代数', grade: 7, chapter: '七上 第2章', type: 'procedural' },
  { id: 'cnm_unrelated', name: '无关节点', domain: '图形与几何', grade: 7, chapter: '七上 第3章', type: 'conceptual' },
]

const edges: DependencyEdge[] = [
  { topicId: 'cnm_j1', prerequisiteId: 'cnm_p1', strength: 'hard' },
  { topicId: 'cnm_j2', prerequisiteId: 'cnm_j1', strength: 'soft' },
]

describe('graphAdapter', () => {
  it('selects prerequisite and dependent neighborhoods by depth', () => {
    const neighborhood = selectNeighborhood(topics, edges, 'cnm_j1', { upDepth: 1, downDepth: 1 })
    expect(neighborhood.topics.map((topic) => topic.id)).toEqual(['cnm_p1', 'cnm_j1', 'cnm_j2'])
    expect(neighborhood.edges).toHaveLength(2)
  })

  it('converts topics and edges into Cytoscape elements with strength classes', () => {
    const elements = graphElements([topics[0]!, topics[1]!], [edges[0]!])
    expect(elements).toHaveLength(3)
    expect(elements[2]?.classes).toBe('hard')
    expect(elements[0]?.data.full).toBe('小学基础')
  })
})


  it('marks diagnostic root, target and answer status classes', () => {
    const elements = graphElements(
      [topics[0]!, topics[1]!],
      [edges[0]!],
      {
        statusById: new Map([['cnm_p1', 'mastered'], ['cnm_j1', 'weak']]),
        rootIds: new Set(['cnm_j1']),
        targetIds: new Set(['cnm_j1']),
      },
    )
    expect(elements[0]?.classes).toContain('status-mastered')
    expect(elements[1]?.classes).toContain('status-weak')
    expect(elements[1]?.classes).toContain('diagnostic-root')
    expect(elements[1]?.classes).toContain('diagnostic-target')
  })


  it('converts legacy diagnostic layout indirect relations to dotted graph edges', () => {
    const graph = graphFromDiagnosticLayout(topics, {
      nodes: [
        { id: 'cnm_p1', status: 'mastered' },
        { id: 'cnm_j1', status: 'weak', isRoot: true, isTarget: true },
      ],
      edges: [{ from: 'cnm_p1', to: 'cnm_j1', direct: false, strength: 'hard' }],
    })
    expect(graph.topics.map((topic) => topic.id)).toEqual(['cnm_p1', 'cnm_j1'])
    expect(graph.edges[0]).toMatchObject({ prerequisiteId: 'cnm_p1', topicId: 'cnm_j1', indirect: true })
  })


  it('folds long diagnostic path by grade while keeping root and target separate', () => {
    const manyTopics: Topic[] = Array.from({ length: 42 }, (_, index) => ({
      id: `cnm_fold_${index}`,
      name: `折叠节点 ${index}`,
      domain: '数与代数',
      grade: 7,
      chapter: '七上 第1章',
      type: 'conceptual',
    }))
    manyTopics[0]!.id = 'cnm_root'
    manyTopics[41]!.id = 'cnm_target'
    const folded = foldDiagnosticLayout(manyTopics, {
      nodes: manyTopics.map((topic, index) => ({
        id: topic.id,
        status: index === 0 ? 'weak' : 'unknown',
        isRoot: index === 0,
        isTarget: index === 41,
      })),
      edges: [{ from: 'cnm_root', to: 'cnm_target', direct: false, strength: 'hard' }],
    }, () => '七年级')

    expect(folded.topics.map((topic) => topic.id).sort()).toEqual(['cnm_root', 'cnm_target', 'grade-7'])
    expect(folded.topics.find((topic) => topic.id === 'grade-7')?.name).toContain('40')
    expect(folded.edges[0]?.indirect).toBe(true)
  })
