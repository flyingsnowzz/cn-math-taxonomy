import { copyFile, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const projectRoot = path.resolve(root, '..')
const sourceDir = path.join(projectRoot, 'data')
const generatedDir = path.join(root, '.generated', 'data')
const subjectDir = path.join(generatedDir, 'subjects')

const subjects = [
  { code: 'math', prefix: 'cnm_' },
  { code: 'english', prefix: 'cne_' },
  { code: 'physics', prefix: 'cnp_' },
  { code: 'chinese', prefix: 'cnc_' },
  { code: 'science', prefix: 'cns_' },
  { code: 'morality', prefix: 'cnd_' },
  { code: 'history', prefix: 'cnh_' },
  { code: 'geography', prefix: 'cng_' },
]

async function readJson(file) {
  return JSON.parse(await readFile(path.join(sourceDir, file), 'utf8'))
}

function writeJson(file, value) {
  return writeFile(file, `${JSON.stringify(value)}\n`)
}

const [topics, edges, questions, standardsFile, aliasesFile] = await Promise.all([
  readJson('topics.json'),
  readJson('dependencies.json'),
  readJson('questions.json'),
  readJson('cn-curriculum-standards.json'),
  readJson('id-aliases.json'),
])

await rm(generatedDir, { recursive: true, force: true })
await mkdir(subjectDir, { recursive: true })

const stats = {
  generatedAt: new Date().toISOString(),
  totalTopics: topics.length,
  totalEdges: edges.length,
  totalQuestions: questions.length,
  subjects: {},
}

for (const subject of subjects) {
  const subjectTopics = topics.filter((topic) => String(topic.id).startsWith(subject.prefix))
  const ids = new Set(subjectTopics.map((topic) => topic.id))
  const subjectEdges = edges.filter(
    (edge) => ids.has(edge.topicId) && ids.has(edge.prerequisiteId),
  )
  const subjectQuestions = questions.filter((question) => ids.has(question.topicId))
  const standardIds = new Set(
    subjectTopics.flatMap((topic) => (topic.standards ?? []).map((ref) => ref.id)),
  )
  const standardItems = (standardsFile.items ?? []).filter((item) => standardIds.has(item.id))
  const aliases = Object.fromEntries(
    Object.entries(aliasesFile.aliases ?? {}).filter(([key, spec]) => {
      const targets = Array.isArray(spec) ? spec : (spec.targets ?? [])
      return key.startsWith(subject.prefix) || targets.some((id) => id.startsWith(subject.prefix))
    }),
  )

  const questionPayload = {
    subject: subject.code,
    questions: subjectQuestions,
  }

  await writeJson(path.join(subjectDir, `${subject.code}-questions.json`), questionPayload)

  const payload = {
    subject: subject.code,
    topics: subjectTopics,
    edges: subjectEdges,
    standards: {
      ...standardsFile,
      items: standardItems,
    },
    aliases: {
      description: aliasesFile.description,
      aliases,
    },
  }

  await writeJson(path.join(subjectDir, `${subject.code}.json`), payload)
  stats.subjects[subject.code] = {
    topics: subjectTopics.length,
    edges: subjectEdges.length,
    questions: subjectQuestions.length,
    standards: standardItems.length,
  }
}

await writeJson(path.join(generatedDir, 'stats.json'), stats)

const runtimeFiles = [
  'topics.json',
  'dependencies.json',
  'questions.json',
  'cn-curriculum-standards.json',
  'id-aliases.json',
]
await Promise.all(runtimeFiles.map((file) => copyFile(path.join(sourceDir, file), path.join(generatedDir, file))))

console.log(`Generated ${subjects.length} subject data packages in .generated/data`)
