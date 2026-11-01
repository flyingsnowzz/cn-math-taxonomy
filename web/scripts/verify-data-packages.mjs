import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const dataDir = path.join(root, '.generated', 'data')
const subjects = ['math', 'english', 'physics', 'chinese', 'science', 'morality', 'history', 'geography']

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const stats = JSON.parse(await readFile(path.join(dataDir, 'stats.json'), 'utf8'))
for (const subject of subjects) {
  const payload = JSON.parse(await readFile(path.join(dataDir, 'subjects', `${subject}.json`), 'utf8'))
  const questionPayload = JSON.parse(await readFile(path.join(dataDir, 'subjects', `${subject}-questions.json`), 'utf8'))
  const expected = stats.subjects[subject]
  assert(payload.subject === subject, `${subject}: package subject mismatch`)
  assert(payload.topics.length === expected.topics, `${subject}: topic count mismatch`)
  assert(payload.edges.length === expected.edges, `${subject}: edge count mismatch`)
  assert(questionPayload.questions.length === expected.questions, `${subject}: question count mismatch`)
  assert(payload.standards.items.length === expected.standards, `${subject}: standard count mismatch`)

  const ids = new Set(payload.topics.map((topic) => topic.id))
  for (const edge of payload.edges) {
    assert(ids.has(edge.topicId) && ids.has(edge.prerequisiteId), `${subject}: dangling edge ${edge.topicId}`)
  }
  for (const question of questionPayload.questions) {
    assert(ids.has(question.topicId), `${subject}: dangling question ${question.id}`)
  }
}

console.log(`Verified ${subjects.length} subject data packages`)
