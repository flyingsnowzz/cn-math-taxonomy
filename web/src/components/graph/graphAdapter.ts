import type { ElementDefinition, LayoutOptions, StylesheetStyle } from 'cytoscape'
import { getSubject, topicStage } from '@/data/subjectRegistry'
import type { DependencyEdge, SubjectCode, Topic } from '@/data/types'

export interface NeighborhoodOptions {
  upDepth: number
  downDepth: number
}

interface EdgeIndex {
  prerequisites: Map<string, DependencyEdge[]>
  dependents: Map<string, DependencyEdge[]>
}

function buildEdgeIndex(edges: DependencyEdge[]): EdgeIndex {
  const prerequisites = new Map<string, DependencyEdge[]>()
  const dependents = new Map<string, DependencyEdge[]>()
  for (const edge of edges) {
    const prereqList = prerequisites.get(edge.topicId) ?? []
    prereqList.push(edge)
    prerequisites.set(edge.topicId, prereqList)

    const dependentList = dependents.get(edge.prerequisiteId) ?? []
    dependentList.push(edge)
    dependents.set(edge.prerequisiteId, dependentList)
  }
  return { prerequisites, dependents }
}

function traverse(
  startId: string,
  index: Map<string, DependencyEdge[]>,
  depth: number,
): Set<string> {
  const found = new Set<string>()
  let frontier = [startId]
  for (let level = 0; level < depth; level += 1) {
    const nextFrontier: string[] = []
    for (const id of frontier) {
      for (const edge of index.get(id) ?? []) {
        const targetId = edge.topicId === id ? edge.prerequisiteId : edge.topicId
        if (!found.has(targetId) && targetId !== startId) {
          found.add(targetId)
          nextFrontier.push(targetId)
        }
      }
    }
    if (nextFrontier.length === 0) break
    frontier = nextFrontier
  }
  return found
}

export function selectNeighborhood(
  topics: Topic[],
  edges: DependencyEdge[],
  selectedId: string,
  options: NeighborhoodOptions,
): { topics: Topic[]; edges: DependencyEdge[] } {
  const byId = new Map(topics.map((topic) => [topic.id, topic]))
  if (!byId.has(selectedId)) return { topics: [], edges: [] }

  const index = buildEdgeIndex(edges)
  const prereqIds = traverse(selectedId, index.prerequisites, options.upDepth)
  const dependentIds = traverse(selectedId, index.dependents, options.downDepth)
  const included = new Set<string>([selectedId, ...prereqIds, ...dependentIds])
  return {
    topics: topics.filter((topic) => included.has(topic.id)),
    edges: edges.filter(
      (edge) => included.has(edge.topicId) && included.has(edge.prerequisiteId),
    ),
  }
}

export function graphForIds(
  topics: Topic[],
  edges: DependencyEdge[],
  ids: string[],
): { topics: Topic[]; edges: DependencyEdge[] } {
  const included = new Set(ids)
  return {
    topics: topics.filter((topic) => included.has(topic.id)),
    edges: edges.filter(
      (edge) => included.has(edge.topicId) && included.has(edge.prerequisiteId),
    ),
  }
}

export function graphElements(topics: Topic[], edges: DependencyEdge[]): ElementDefinition[] {
  const nodes: ElementDefinition[] = topics.map((topic) => ({
    data: {
      id: topic.id,
      label: topic.name,
      stage: topicStage(topic),
      domain: topic.domain,
      grade: topic.grade,
    },
    classes: topicStage(topic),
  }))

  const edgeNodes: ElementDefinition[] = edges.map((edge) => ({
    data: {
      id: `${edge.prerequisiteId}->${edge.topicId}`,
      source: edge.prerequisiteId,
      target: edge.topicId,
      strength: edge.strength,
      reason: edge.reason ?? '',
    },
    classes: edge.strength === 'soft' ? 'soft' : 'hard',
  }))

  return [...nodes, ...edgeNodes]
}

export function graphStylesheet(subject: SubjectCode): StylesheetStyle[] {
  const color = getSubject(subject).graphColor
  return [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'background-color': color,
        color: '#172033',
        'font-size': 12,
        'text-wrap': 'wrap',
        'text-max-width': '120px',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 8,
        'text-background-color': '#ffffff',
        'text-background-opacity': 0.82,
        'text-background-padding': '2px',
        'border-width': 1,
        'border-color': '#ffffff',
        width: '18px',
        height: '18px',
      },
    },
    {
      selector: 'node.primary',
      style: { 'background-color': '#3e9a8f' },
    },
    {
      selector: 'node.junior',
      style: { 'background-color': color },
    },
    {
      selector: 'node.senior',
      style: { 'background-color': '#a55bd8' },
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 4,
        'border-color': '#f97316',
        'background-blacken': 0,
        width: 26,
        height: 26,
      },
    },
    {
      selector: 'edge',
      style: {
        width: 1.6,
        'line-color': '#7890a6',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#7890a6',
        'curve-style': 'bezier',
        'arrow-scale': 0.9,
      },
    },
    {
      selector: 'edge.soft',
      style: {
        'line-style': 'dashed',
        'line-color': '#a9b8c6',
        'target-arrow-color': '#a9b8c6',
        opacity: 0.78,
      },
    },
    {
      selector: 'edge.highlighted',
      style: {
        'line-color': '#f97316',
        'target-arrow-color': '#f97316',
        width: 2.4,
      },
    },
    {
      selector: 'node.faded',
      style: { opacity: 0.22 },
    },
    {
      selector: 'edge.faded',
      style: { opacity: 0.08 },
    },
  ]
}

export type DagreLayoutOptions = LayoutOptions & {
  rankDir?: 'TB' | 'BT' | 'LR' | 'RL'
  nodeSep?: number
  rankSep?: number
  edgeSep?: number
  animate?: boolean
  fit?: boolean
  padding?: number
}

export const dagreLayout: DagreLayoutOptions = {
  name: 'dagre',
  rankDir: 'TB',
  nodeSep: 42,
  rankSep: 72,
  edgeSep: 16,
  animate: false,
  fit: true,
  padding: 32,
}
