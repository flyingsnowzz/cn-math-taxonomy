import { describe, expect, it } from 'vitest'
import { graphElements, selectNeighborhood } from '../graphAdapter'
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
  })
})
