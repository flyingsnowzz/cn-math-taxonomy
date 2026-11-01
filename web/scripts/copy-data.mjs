import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const generatedData = path.join(root, '.generated', 'data')
const targetData = path.join(root, 'dist', 'data')
const targetSubjects = path.join(targetData, 'subjects')

await rm(targetData, { recursive: true, force: true })
await mkdir(targetSubjects, { recursive: true })
await cp(path.join(generatedData, 'subjects'), targetSubjects, { recursive: true })
await cp(path.join(generatedData, 'stats.json'), path.join(targetData, 'stats.json'))
