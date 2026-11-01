import { parseChapter } from '@/engine/engineAdapter'
import type { Topic } from './types'

export interface ChapterTopic {
  topic: Topic
  section: string
}

export interface ChapterGroup {
  volume: string
  chapterNo: string
  chapterName: string
  key: string
  label: string
  fullLabel: string
  topics: ChapterTopic[]
}

export interface VolumeGroup {
  volume: string
  chapters: ChapterGroup[]
}

export interface ChapterTree {
  volumes: VolumeGroup[]
  chaptersByKey: Map<string, ChapterGroup>
}

export function buildChapterTree(topics: Topic[]): ChapterTree {
  const volumes = new Map<string, VolumeGroup>()
  const chaptersByKey = new Map<string, ChapterGroup>()

  for (const topic of topics.slice().sort((a, b) => a.chapter.localeCompare(b.chapter, 'zh-Hans-CN'))) {
    const parsed = parseChapter(topic.chapter)
    if (!parsed.volume) continue

    let volume = volumes.get(parsed.volume)
    if (!volume) {
      volume = { volume: parsed.volume, chapters: [] }
      volumes.set(parsed.volume, volume)
    }

    const key = `${parsed.volume} ${parsed.chapterNo}`
    let chapter = chaptersByKey.get(key)
    if (!chapter) {
      chapter = {
        volume: parsed.volume,
        chapterNo: parsed.chapterNo,
        chapterName: parsed.chapterName,
        key,
        label: parsed.chapterNo ? `${parsed.chapterNo} ${parsed.chapterName}` : parsed.chapterName,
        fullLabel: parsed.chapterNo
          ? `${parsed.volume} ${parsed.chapterNo} ${parsed.chapterName}`
          : `${parsed.volume} ${parsed.chapterName}`,
        topics: [],
      }
      chaptersByKey.set(key, chapter)
      volume.chapters.push(chapter)
    }
    chapter.topics.push({ topic, section: parsed.section })
  }

  return { volumes: [...volumes.values()], chaptersByKey }
}
